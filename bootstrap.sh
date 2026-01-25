#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER="${1:-mac-mini}"

echo "=== Bootstrapping k8s-platform for cluster: $CLUSTER ==="

# Check prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed. Aborting."; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "helm is required but not installed. Aborting."; exit 1; }

# Check cluster connectivity
echo "Checking cluster connectivity..."
kubectl cluster-info || { echo "Cannot connect to cluster. Check your kubeconfig."; exit 1; }

# Create namespaces
echo "Creating namespaces..."
kubectl apply -f "$SCRIPT_DIR/infrastructure/namespaces/namespaces.yaml"

# Install cert-manager first (Traefik may need it for TLS)
echo "Installing cert-manager..."
helm upgrade --install cert-manager "$SCRIPT_DIR/infrastructure/cert-manager" \
    -n cert-manager \
    --create-namespace \
    --wait

# Apply cluster-specific secrets if they exist
SECRETS_DIR="$SCRIPT_DIR/clusters/$CLUSTER/secrets"
if [ -d "$SECRETS_DIR" ] && [ "$(ls -A "$SECRETS_DIR"/*.yaml 2>/dev/null)" ]; then
    echo "Applying cluster secrets..."
    kubectl apply -f "$SECRETS_DIR/"
fi

# Apply ClusterIssuers after cert-manager is ready
echo "Waiting for cert-manager to be ready..."
kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=120s
kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=120s

# Install Traefik
echo "Installing Traefik..."
VALUES_FILE="$SCRIPT_DIR/infrastructure/traefik/values.yaml"
CLUSTER_VALUES="$SCRIPT_DIR/infrastructure/traefik/values-$CLUSTER.yaml"
if [ -f "$CLUSTER_VALUES" ]; then
    helm upgrade --install traefik "$SCRIPT_DIR/infrastructure/traefik" \
        -n traefik \
        --create-namespace \
        -f "$VALUES_FILE" \
        -f "$CLUSTER_VALUES" \
        --wait
else
    helm upgrade --install traefik "$SCRIPT_DIR/infrastructure/traefik" \
        -n traefik \
        --create-namespace \
        -f "$VALUES_FILE" \
        --wait
fi

# Install ArgoCD
echo "Installing ArgoCD..."
VALUES_FILE="$SCRIPT_DIR/infrastructure/argocd/values.yaml"
CLUSTER_VALUES="$SCRIPT_DIR/infrastructure/argocd/values-$CLUSTER.yaml"
if [ -f "$CLUSTER_VALUES" ]; then
    helm upgrade --install argocd "$SCRIPT_DIR/infrastructure/argocd" \
        -n argocd \
        --create-namespace \
        -f "$VALUES_FILE" \
        -f "$CLUSTER_VALUES" \
        --wait
else
    helm upgrade --install argocd "$SCRIPT_DIR/infrastructure/argocd" \
        -n argocd \
        --create-namespace \
        -f "$VALUES_FILE" \
        --wait
fi

# Get ArgoCD admin password
echo ""
echo "=== Bootstrap Complete ==="
echo ""
echo "ArgoCD admin password:"
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo ""
echo ""
echo "Access ArgoCD UI:"
echo "  kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo "  Open: https://localhost:8080"
echo ""
echo "Traefik Dashboard:"
echo "  kubectl port-forward svc/traefik -n traefik 9000:9000"
echo "  Open: http://localhost:9000/dashboard/"
