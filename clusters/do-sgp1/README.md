# DigitalOcean SGP1 Cluster

Production DOKS cluster in Singapore, provisioned via Pulumi.

## Infrastructure

- **Region**: sgp1 (Singapore)
- **Nodes**: 3x s-2vcpu-4gb (autoscale 2-4)
- **Database**: DO Managed PostgreSQL 16 (macrosee_prod, trading, kumon)
- **Load Balancer**: DigitalOcean LB via Traefik
- **TLS**: Let's Encrypt via cert-manager (DNS-01 / Cloudflare)

## Provisioning

```bash
cd pulumi/
pulumi up --stack prod
```

## kubectl Access

```bash
doctl kubernetes cluster kubeconfig save k8s-platform-prod
```
