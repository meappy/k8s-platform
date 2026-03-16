import * as digitalocean from "@pulumi/digitalocean";

// VPC for all resources in Singapore region
export const vpc = new digitalocean.Vpc("k8s-platform-vpc", {
    name: "k8s-platform-vpc",
    region: "sgp1",
    ipRange: "10.100.0.0/16",
    description: "VPC for k8s-platform DOKS cluster and managed services",
});
