# k8s-platform

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://github.com/meappy/k8s-platform/stargazers"><img src="https://img.shields.io/github/stars/meappy/k8s-platform" alt="Stars" /></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits" /></a>
  <img src="https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white" alt="Kubernetes" />
  <img src="https://img.shields.io/badge/Helm-0F1689?logo=helm&logoColor=white" alt="Helm" />
  <img src="https://img.shields.io/badge/Argo%20CD-EF7B4D?logo=argo&logoColor=white" alt="Argo CD" />
</p>

Kubernetes cluster platform components managed via GitOps.

## Components

- **ArgoCD** - GitOps continuous delivery
- **Traefik** - Ingress controller with automatic TLS
- **cert-manager** - Certificate management with Cloudflare Origin CA

## Architecture

```
Internet → Cloudflare (edge TLS)
         → Raspberry Pi nginx (Origin cert, mutual TLS)
         → Traefik Ingress (internal TLS via cert-manager)
         → Application Services
```

## Quick Start

### Prerequisites

- Kubernetes cluster (tested on Mac Mini with Docker Desktop/Rancher Desktop)
- `kubectl` configured to access the cluster
- `helm` v3.x installed

### Bootstrap

```bash
# 1. Clone this repo
git clone git@github.com:meappy/k8s-platform.git
cd k8s-platform

# 2. Create secrets (not in git)
cp clusters/mac-mini/secrets/cloudflare-api-token.yaml.example \
   clusters/mac-mini/secrets/cloudflare-api-token.yaml
# Edit with your Cloudflare API token

# 3. Run bootstrap script
./bootstrap.sh
```

### Manual Installation

```bash
# Install ArgoCD
kubectl create namespace argocd
helm install argocd ./infrastructure/argocd -n argocd

# Install Traefik
kubectl create namespace traefik
helm install traefik ./infrastructure/traefik -n traefik

# Install cert-manager
kubectl create namespace cert-manager
helm install cert-manager ./infrastructure/cert-manager -n cert-manager
```

## Cluster-Specific Configuration

Cluster-specific overrides are in `clusters/<cluster-name>/`:

- `mac-mini/` - Gerald's Mac Mini homelab cluster

## Adding Applications

Applications are deployed via ArgoCD ApplicationSets. Add your app to the `apps/` directory.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for how to fork, set up your environment, and submit a pull request.

## License

MIT License — see [LICENSE](LICENSE) for details.
