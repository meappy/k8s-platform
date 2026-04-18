import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";

interface ClusterArgs {
    vpc: digitalocean.Vpc;
}

export function createCluster(args: ClusterArgs) {
    // Resolve the latest 1.31.x Kubernetes version
    const k8sVersions = digitalocean.getKubernetesVersionsOutput({
        versionPrefix: "1.35.",
    });

    const cluster = new digitalocean.KubernetesCluster("k8s-platform-prod", {
        name: "k8s-platform-prod",
        region: "sgp1",
        version: k8sVersions.latestVersion,
        vpcUuid: args.vpc.id,
        ha: false,
        autoUpgrade: true,
        surgeUpgrade: true,
        maintenancePolicy: {
            day: "sunday",
            startTime: "04:00",
        },
        nodePool: {
            name: "default-pool",
            size: "s-2vcpu-4gb",
            nodeCount: 3,
            autoScale: true,
            minNodes: 2,
            maxNodes: 4,
            labels: {
                "nodepool": "default",
            },
        },
    });

    // Cloudflare IP ranges — only these can reach ports 80/443
    const config = new pulumi.Config();
    const cloudflareIpv4 = config.requireObject<string[]>("cloudflareIps");

    // Firewall: allow HTTP/HTTPS only from Cloudflare, allow all within VPC
    const firewall = new digitalocean.Firewall("k8s-cloudflare-only", {
        name: "k8s-cloudflare-only",
        dropletIds: cluster.nodePool.apply(np => np.nodes?.map(n => parseInt(n.dropletId)) ?? []),
        inboundRules: [
            // HTTP from Cloudflare only
            {
                protocol: "tcp",
                portRange: "80",
                sourceAddresses: cloudflareIpv4,
            },
            // HTTPS from Cloudflare only
            {
                protocol: "tcp",
                portRange: "443",
                sourceAddresses: cloudflareIpv4,
            },
            // All traffic within VPC
            {
                protocol: "tcp",
                portRange: "1-65535",
                sourceAddresses: [args.vpc.ipRange],
            },
            {
                protocol: "udp",
                portRange: "1-65535",
                sourceAddresses: [args.vpc.ipRange],
            },
            {
                protocol: "icmp",
                sourceAddresses: [args.vpc.ipRange],
            },
        ],
        outboundRules: [
            {
                protocol: "tcp",
                portRange: "1-65535",
                destinationAddresses: ["0.0.0.0/0", "::/0"],
            },
            {
                protocol: "udp",
                portRange: "1-65535",
                destinationAddresses: ["0.0.0.0/0", "::/0"],
            },
            {
                protocol: "icmp",
                destinationAddresses: ["0.0.0.0/0", "::/0"],
            },
        ],
    });

    return {
        cluster,
        kubeconfig: cluster.kubeConfigs.apply(configs => configs[0].rawConfig),
        endpoint: cluster.endpoint,
        clusterId: cluster.id,
    };
}
