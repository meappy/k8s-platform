import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

interface PlatformArgs {
    kubeconfig: pulumi.Output<string>;
}

const NAMESPACES = [
    "argocd",
    "traefik",
    "cert-manager",
    "macrosee-prod",
    "trading-bot",
    "kumon-marker",
    "openclaw",
];

export function createPlatform(args: PlatformArgs) {
    const config = new pulumi.Config();
    const argocdUrl = config.require("argocdUrl");
    const acmeEmail = config.require("acmeEmail");

    const provider = new k8s.Provider("do-k8s", {
        kubeconfig: args.kubeconfig,
    });

    // Create namespaces
    const namespaces = NAMESPACES.map(name =>
        new k8s.core.v1.Namespace(`ns-${name}`, {
            metadata: {
                name,
                labels: {
                    "app.kubernetes.io/managed-by": "pulumi",
                },
            },
        }, { provider })
    );

    const nsMap = Object.fromEntries(
        NAMESPACES.map((name, i) => [name, namespaces[i]])
    );

    // ─── cert-manager ───────────────────────────────────────────────────
    // Values unwrapped from the cert-manager: nesting in existing values.yaml
    const certManager = new k8s.helm.v3.Release("cert-manager", {
        name: "cert-manager",
        namespace: "cert-manager",
        chart: "cert-manager",
        version: "v1.14.3",
        repositoryOpts: {
            repo: "https://charts.jetstack.io",
        },
        values: {
            installCRDs: true,
            prometheus: { enabled: false },
            webhook: { timeoutSeconds: 30 },
            resources: {
                requests: { cpu: "50m", memory: "64Mi" },
                limits: { cpu: "200m", memory: "128Mi" },
            },
            replicaCount: 1,
        },
        waitForJobs: true,
    }, { provider, dependsOn: [nsMap["cert-manager"]] });

    // Wait for cert-manager webhook to be ready before creating CRs
    const certManagerReady = new k8s.apps.v1.DeploymentPatch("cert-manager-webhook-wait", {
        metadata: {
            name: "cert-manager-webhook",
            namespace: "cert-manager",
            annotations: {
                "pulumi.com/waitFor": "condition=Available",
            },
        },
    }, { provider, dependsOn: [certManager] });

    // ─── ClusterIssuers ─────────────────────────────────────────────────
    // Self-signed issuer (for bootstrapping the internal CA)
    const selfSignedIssuer = new k8s.apiextensions.CustomResource("selfsigned-issuer", {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: { name: "selfsigned-issuer" },
        spec: { selfSigned: {} },
    }, { provider, dependsOn: [certManagerReady] });

    // Internal CA certificate
    const internalCaCert = new k8s.apiextensions.CustomResource("internal-ca", {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
            name: "internal-ca",
            namespace: "cert-manager",
        },
        spec: {
            isCA: true,
            commonName: "internal-ca",
            secretName: "internal-ca-secret",
            duration: "87600h",
            renewBefore: "8760h",
            privateKey: {
                algorithm: "ECDSA",
                size: 256,
            },
            issuerRef: {
                name: "selfsigned-issuer",
                kind: "ClusterIssuer",
                group: "cert-manager.io",
            },
        },
    }, { provider, dependsOn: [selfSignedIssuer] });

    // Internal CA issuer
    const internalCaIssuer = new k8s.apiextensions.CustomResource("internal-ca-issuer", {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: { name: "internal-ca-issuer" },
        spec: {
            ca: { secretName: "internal-ca-secret" },
        },
    }, { provider, dependsOn: [internalCaCert] });

    // Let's Encrypt production issuer (DNS-01 via Cloudflare)
    const letsencryptProd = new k8s.apiextensions.CustomResource("letsencrypt-prod", {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: { name: "letsencrypt-prod" },
        spec: {
            acme: {
                server: "https://acme-v02.api.letsencrypt.org/directory",
                email: acmeEmail,
                privateKeySecretRef: { name: "letsencrypt-prod-key" },
                solvers: [{
                    dns01: {
                        cloudflare: {
                            apiTokenSecretRef: {
                                name: "cloudflare-api-token",
                                key: "api-token",
                            },
                        },
                    },
                }],
            },
        },
    }, { provider, dependsOn: [certManagerReady] });

    // Let's Encrypt staging issuer (for testing)
    const letsencryptStaging = new k8s.apiextensions.CustomResource("letsencrypt-staging", {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: { name: "letsencrypt-staging" },
        spec: {
            acme: {
                server: "https://acme-staging-v02.api.letsencrypt.org/directory",
                email: acmeEmail,
                privateKeySecretRef: { name: "letsencrypt-staging-key" },
                solvers: [{
                    dns01: {
                        cloudflare: {
                            apiTokenSecretRef: {
                                name: "cloudflare-api-token",
                                key: "api-token",
                            },
                        },
                    },
                }],
            },
        },
    }, { provider, dependsOn: [certManagerReady] });

    // ─── Traefik ────────────────────────────────────────────────────────
    // Values adapted from existing values.yaml — LoadBalancer instead of NodePort,
    // with DO LB annotations and proxy protocol for DigitalOcean
    const traefik = new k8s.helm.v3.Release("traefik", {
        name: "traefik",
        namespace: "traefik",
        chart: "traefik",
        version: "26.0.0",
        repositoryOpts: {
            repo: "https://traefik.github.io/charts",
        },
        values: {
            serviceAccount: {
                automountServiceAccountToken: true,
            },
            deployment: { replicas: 1 },
            service: {
                type: "LoadBalancer",
                annotations: {
                    // DigitalOcean LB annotations
                    "service.beta.kubernetes.io/do-loadbalancer-name": "k8s-platform-lb",
                    "service.beta.kubernetes.io/do-loadbalancer-protocol": "tcp",
                    "service.beta.kubernetes.io/do-loadbalancer-enable-proxy-protocol": "true",
                    "service.beta.kubernetes.io/do-loadbalancer-size-unit": "1",
                },
            },
            ports: {
                web: {
                    port: 8000,
                    exposedPort: 80,
                    expose: true,
                    protocol: "TCP",
                    proxyProtocol: {
                        trustedIPs: ["10.100.0.0/16", "10.244.0.0/16"],
                    },
                },
                websecure: {
                    port: 8443,
                    exposedPort: 443,
                    expose: true,
                    protocol: "TCP",
                    tls: { enabled: true },
                    proxyProtocol: {
                        trustedIPs: ["10.100.0.0/16", "10.244.0.0/16"],
                    },
                },
                traefik: {
                    port: 9000,
                    expose: false,
                },
            },
            ingressRoute: {
                dashboard: { enabled: false },
            },
            providers: {
                kubernetesCRD: {
                    enabled: true,
                    allowCrossNamespace: true,
                },
                kubernetesIngress: {
                    enabled: true,
                    publishedService: { enabled: true },
                },
            },
            logs: {
                general: { level: "INFO" },
                access: { enabled: true },
            },
            additionalArguments: [
                "--api.dashboard=true",
                "--api.insecure=true",
                "--entrypoints.web.proxyProtocol.insecure",
                "--entrypoints.websecure.proxyProtocol.insecure",
            ],
            resources: {
                requests: { cpu: "100m", memory: "128Mi" },
                limits: { cpu: "500m", memory: "256Mi" },
            },
        },
    }, { provider, dependsOn: [nsMap["traefik"], certManager] });

    // ─── ArgoCD ─────────────────────────────────────────────────────────
    // Values unwrapped from the argo-cd: nesting in existing values.yaml
    const argocd = new k8s.helm.v3.Release("argocd", {
        name: "argocd",
        namespace: "argocd",
        chart: "argo-cd",
        version: "9.4.2",
        repositoryOpts: {
            repo: "https://argoproj.github.io/argo-helm",
        },
        values: {
            crds: {
                install: true,
                keep: true,
            },
            server: {
                service: { type: "ClusterIP" },
                ingress: { enabled: false },
            },
            "redis-ha": { enabled: false },
            controller: { replicas: 1 },
            repoServer: { replicas: 1 },
            applicationSet: { replicas: 1 },
            notifications: { enabled: true },
            configs: {
                params: {
                    "server.insecure": true,
                },
                cm: {
                    url: argocdUrl,
                    "statusbadge.enabled": "true",
                    "resource.exclusions": `- apiGroups:
    - cilium.io
  kinds:
    - CiliumIdentity
  clusters:
    - "*"
`,
                },
            },
        },
    }, { provider, dependsOn: [nsMap["argocd"]] });

    return {
        provider,
        certManager,
        traefik,
        argocd,
        namespaces,
        loadBalancerIp: traefik.status.apply(s => {
            const ns = s.namespace;
            return ns;
        }),
    };
}
