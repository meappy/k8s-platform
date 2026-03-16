import * as pulumi from "@pulumi/pulumi";
import { vpc } from "./network";
import { createCluster } from "./cluster";
import { createDatabase } from "./database";
import { createPlatform } from "./platform";

// ─── Infrastructure ─────────────────────────────────────────────────────────

// VPC (network.ts)
// Exported directly from module

// DOKS Cluster
const cluster = createCluster({ vpc });

// Managed PostgreSQL
const database = createDatabase({
    vpc,
    clusterId: cluster.clusterId,
});

// ─── Platform Bootstrap ─────────────────────────────────────────────────────

// Helm releases: cert-manager, Traefik, ArgoCD + ClusterIssuers + namespaces
const platform = createPlatform({
    kubeconfig: cluster.kubeconfig,
});

// ─── Exports ────────────────────────────────────────────────────────────────

export const vpcId = vpc.id;
export const clusterEndpoint = cluster.endpoint;
export const kubeconfig = pulumi.secret(cluster.kubeconfig);
export const dbHost = database.privateHost;
export const dbPort = database.port;
