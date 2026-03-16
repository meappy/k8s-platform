import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";

interface DatabaseArgs {
    vpc: digitalocean.Vpc;
    clusterId: pulumi.Output<string>;
}

const DB_NAMES = ["macrosee", "trading-bot", "kumon-marker"] as const;
const DB_USERS = ["macrosee", "trading", "kumon"] as const;

export function createDatabase(args: DatabaseArgs) {
    // Managed PostgreSQL cluster — single node, private networking
    const dbCluster = new digitalocean.DatabaseCluster("k8s-platform-pg", {
        name: "k8s-platform-pg",
        engine: "pg",
        version: "16",
        size: "db-s-1vcpu-1gb",
        region: "sgp1",
        nodeCount: 1,
        privateNetworkUuid: args.vpc.id,
    });

    // Create databases
    const databases = DB_NAMES.map(name =>
        new digitalocean.DatabaseDb(`db-${name}`, {
            clusterId: dbCluster.id,
            name,
        })
    );

    // Create users
    const users = DB_USERS.map(name =>
        new digitalocean.DatabaseUser(`dbuser-${name}`, {
            clusterId: dbCluster.id,
            name,
        })
    );

    // Firewall: allow only from the DOKS cluster
    const dbFirewall = new digitalocean.DatabaseFirewall("pg-firewall", {
        clusterId: dbCluster.id,
        rules: [{
            type: "k8s",
            value: args.clusterId,
        }],
    });

    // Build connection URIs for each database/user pair
    const connectionUris = DB_NAMES.map((dbName, i) => {
        const user = users[i];
        return pulumi.all([
            dbCluster.privateHost,
            dbCluster.port,
            user.password,
            user.name,
        ]).apply(([host, port, password, username]) =>
            `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbName}?sslmode=require`
        );
    });

    return {
        privateHost: dbCluster.privateHost,
        port: dbCluster.port,
        connectionUris: Object.fromEntries(
            DB_NAMES.map((name, i) => [name, connectionUris[i]])
        ),
        databases,
        users,
    };
}
