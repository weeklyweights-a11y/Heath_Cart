/**
 * Provision HealthCart Aurora PostgreSQL cluster (idempotent).
 * Uses ~/.aws/credentials default profile, region from ~/.aws/config.
 */
import "./load-env";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  RDSClient,
  DescribeDBClustersCommand,
  CreateDBClusterCommand,
  CreateDBInstanceCommand,
  DescribeDBSubnetGroupsCommand,
  CreateDBSubnetGroupCommand,
  waitUntilDBClusterAvailable,
  waitUntilDBInstanceAvailable,
} from "@aws-sdk/client-rds";
import {
  EC2Client,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
} from "@aws-sdk/client-ec2";
import {
  awsProfile,
  printCallerIdentity,
  isBlockedIdentity,
  printWrongAccountHelp,
} from "./aws-utils";

const REGION = process.env.AWS_REGION ?? "us-west-2";
const CLUSTER_ID = "healthcart-cluster";
const DB_NAME = "healthcart";
const MASTER_USER = "healthcart_admin";
const INSTANCE_ID = "healthcart-instance-1";
const SG_NAME = "healthcart-aurora-sg";
const SUBNET_GROUP = "healthcart-subnet-group";

const rds = new RDSClient({ region: REGION });
const ec2 = new EC2Client({ region: REGION });

function envLocalPath(): string {
  return resolve(process.cwd(), ".env.local");
}

function readEnvLocal(): string {
  const p = envLocalPath();
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

function upsertEnvLocal(databaseUrl: string, password: string): void {
  const p = envLocalPath();
  let content = readEnvLocal();
  const geminiMatch = content.match(/^GEMINI_API_KEY=.*$/m);
  const gemini = geminiMatch?.[0] ?? 'GEMINI_API_KEY=""';

  content = `# HealthCart Aurora PostgreSQL (auto-provisioned — do not commit)
DATABASE_URL="${databaseUrl}"
${gemini}
# Master password (rotate if exposed): stored locally only
HEALTHCART_DB_PASSWORD="${password}"
`;

  writeFileSync(p, content, "utf8");
  console.log(`Updated ${p} with DATABASE_URL`);
}

async function getDefaultVpcId(): Promise<string> {
  const vpcs = await ec2.send(
    new DescribeVpcsCommand({ Filters: [{ Name: "is-default", Values: ["true"] }] }),
  );
  const vpcId = vpcs.Vpcs?.[0]?.VpcId;
  if (!vpcId) throw new Error("No default VPC found in " + REGION);
  return vpcId;
}

async function getSubnetIds(vpcId: string): Promise<string[]> {
  const subs = await ec2.send(
    new DescribeSubnetsCommand({ Filters: [{ Name: "vpc-id", Values: [vpcId] }] }),
  );
  const ids = (subs.Subnets ?? []).map((s) => s.SubnetId).filter(Boolean) as string[];
  if (ids.length < 2) throw new Error("Need at least 2 subnets in default VPC");
  return ids.slice(0, 3);
}

async function ensureSecurityGroup(vpcId: string): Promise<string> {
  const existing = await ec2.send(
    new DescribeSecurityGroupsCommand({
      Filters: [
        { Name: "group-name", Values: [SG_NAME] },
        { Name: "vpc-id", Values: [vpcId] },
      ],
    }),
  );
  if (existing.SecurityGroups?.[0]?.GroupId) {
    return existing.SecurityGroups[0].GroupId;
  }

  const created = await ec2.send(
    new CreateSecurityGroupCommand({
      GroupName: SG_NAME,
      Description: "HealthCart Aurora PostgreSQL",
      VpcId: vpcId,
    }),
  );
  const sgId = created.GroupId!;
  await ec2.send(
    new AuthorizeSecurityGroupIngressCommand({
      GroupId: sgId,
      IpPermissions: [
        {
          IpProtocol: "tcp",
          FromPort: 5432,
          ToPort: 5432,
          IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "PostgreSQL for Vercel + dev" }],
        },
      ],
    }),
  );
  return sgId;
}

async function ensureSubnetGroup(subnetIds: string[]): Promise<void> {
  try {
    await rds.send(new DescribeDBSubnetGroupsCommand({ DBSubnetGroupName: SUBNET_GROUP }));
    return;
  } catch {
    /* create below */
  }
  await rds.send(
    new CreateDBSubnetGroupCommand({
      DBSubnetGroupName: SUBNET_GROUP,
      DBSubnetGroupDescription: "HealthCart Aurora subnets",
      SubnetIds: subnetIds,
    }),
  );
}

function buildDatabaseUrl(endpoint: string, password: string): string {
  const encodedPass = encodeURIComponent(password);
  return `postgresql://${MASTER_USER}:${encodedPass}@${endpoint}:5432/${DB_NAME}?sslmode=require&connection_limit=1`;
}

async function findExistingCluster(): Promise<{ endpoint: string; password?: string } | null> {
  try {
    const res = await rds.send(
      new DescribeDBClustersCommand({ DBClusterIdentifier: CLUSTER_ID }),
    );
    const cluster = res.DBClusters?.[0];
    if (!cluster?.Endpoint) return null;

    const local = readEnvLocal();
    const passMatch = local.match(/^HEALTHCART_DB_PASSWORD="([^"]+)"/m);
    return { endpoint: cluster.Endpoint, password: passMatch?.[1] };
  } catch (err: unknown) {
    const code = (err as { name?: string }).name;
    if (code === "DBClusterNotFoundFault") return null;
    throw err;
  }
}

async function main(): Promise<void> {
  const arn = await printCallerIdentity();
  if (isBlockedIdentity(arn)) {
    printWrongAccountHelp();
    process.exit(1);
  }

  console.log(`Region: ${REGION}`);

  const existing = await findExistingCluster();
  if (existing?.endpoint && existing.password) {
    const url = buildDatabaseUrl(existing.endpoint, existing.password);
    upsertEnvLocal(url, existing.password);
    console.log("Cluster already exists:", CLUSTER_ID);
    console.log("Endpoint:", existing.endpoint);
    return;
  }

  const password =
    process.env.HEALTHCART_DB_PASSWORD ??
    randomBytes(16).toString("base64url").slice(0, 20) + "Hc1!";

  const vpcId = await getDefaultVpcId();
  const subnetIds = await getSubnetIds(vpcId);
  const sgId = await ensureSecurityGroup(vpcId);
  await ensureSubnetGroup(subnetIds);

  console.log("Creating Aurora cluster (5–10 minutes)...");

  await rds.send(
    new CreateDBClusterCommand({
      DBClusterIdentifier: CLUSTER_ID,
      Engine: "aurora-postgresql",
      EngineVersion: "15.12",
      DatabaseName: DB_NAME,
      MasterUsername: MASTER_USER,
      MasterUserPassword: password,
      VpcSecurityGroupIds: [sgId],
      DBSubnetGroupName: SUBNET_GROUP,
      ServerlessV2ScalingConfiguration: { MinCapacity: 0.5, MaxCapacity: 2 },
      StorageEncrypted: true,
      BackupRetentionPeriod: 1,
      DeletionProtection: false,
      EnableHttpEndpoint: false,
    }),
  );

  await rds.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: INSTANCE_ID,
      DBClusterIdentifier: CLUSTER_ID,
      DBInstanceClass: "db.serverless",
      Engine: "aurora-postgresql",
      PubliclyAccessible: true,
    }),
  );

  console.log("Waiting for cluster...");
  await waitUntilDBClusterAvailable(
    { client: rds, maxWaitTime: 900 },
    { DBClusterIdentifier: CLUSTER_ID },
  );
  await waitUntilDBInstanceAvailable(
    { client: rds, maxWaitTime: 900 },
    { DBInstanceIdentifier: INSTANCE_ID },
  );

  const cluster = await rds.send(
    new DescribeDBClustersCommand({ DBClusterIdentifier: CLUSTER_ID }),
  );
  const endpoint = cluster.DBClusters?.[0]?.Endpoint;
  if (!endpoint) throw new Error("Cluster created but endpoint missing");

  const url = buildDatabaseUrl(endpoint, password);
  upsertEnvLocal(url, password);

  console.log("Aurora cluster ready.");
  console.log("Cluster:", CLUSTER_ID);
  console.log("Endpoint:", endpoint);
  console.log("Database:", DB_NAME);
  console.log("User:", MASTER_USER);
  console.log("\nNext: add DATABASE_URL to Vercel env vars, then run:");
  console.log("  npx prisma migrate deploy");
}

main().catch((err: unknown) => {
  const msg = String((err as Error).message ?? err);
  if (msg.includes("AccessDenied")) {
    printWrongAccountHelp();
  }
  console.error(err);
  process.exit(1);
});
