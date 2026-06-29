/**
 * Delete HealthCart Aurora resources (idempotent).
 * Run with: AWS_PROFILE=healthcart npm run teardown:aurora
 */
import "./load-env";
import {
  RDSClient,
  DescribeDBInstancesCommand,
  DeleteDBInstanceCommand,
  DescribeDBClustersCommand,
  DeleteDBClusterCommand,
  DescribeDBSubnetGroupsCommand,
  DeleteDBSubnetGroupCommand,
  waitUntilDBInstanceDeleted,
} from "@aws-sdk/client-rds";
import {
  EC2Client,
  DescribeSecurityGroupsCommand,
  DeleteSecurityGroupCommand,
} from "@aws-sdk/client-ec2";
import {
  awsProfile,
  printCallerIdentity,
  isBlockedIdentity,
  printWrongAccountHelp,
} from "./aws-utils";

const REGION = process.env.AWS_REGION ?? "us-west-2";
const CLUSTER_ID = "healthcart-cluster";
const INSTANCE_ID = "healthcart-instance-1";
const SG_NAME = "healthcart-aurora-sg";
const SUBNET_GROUP = "healthcart-subnet-group";

const rds = new RDSClient({ region: REGION });
const ec2 = new EC2Client({ region: REGION });

async function deleteInstance(): Promise<void> {
  try {
    const inst = await rds.send(
      new DescribeDBInstancesCommand({ DBInstanceIdentifier: INSTANCE_ID }),
    );
    if (!inst.DBInstances?.length) {
      console.log("No instance to delete:", INSTANCE_ID);
      return;
    }
    console.log("Deleting instance:", INSTANCE_ID);
    await rds.send(
      new DeleteDBInstanceCommand({
        DBInstanceIdentifier: INSTANCE_ID,
        SkipFinalSnapshot: true,
      }),
    );
    await waitUntilDBInstanceDeleted(
      { client: rds, maxWaitTime: 900 },
      { DBInstanceIdentifier: INSTANCE_ID },
    );
    console.log("Instance deleted.");
  } catch (err: unknown) {
    const code = (err as { name?: string }).name;
    if (code === "DBInstanceNotFoundFault") {
      console.log("Instance already absent:", INSTANCE_ID);
      return;
    }
    throw err;
  }
}

async function deleteCluster(): Promise<void> {
  try {
    const cl = await rds.send(
      new DescribeDBClustersCommand({ DBClusterIdentifier: CLUSTER_ID }),
    );
    if (!cl.DBClusters?.length) {
      console.log("No cluster to delete:", CLUSTER_ID);
      return;
    }
    console.log("Deleting cluster:", CLUSTER_ID);
    await rds.send(
      new DeleteDBClusterCommand({
        DBClusterIdentifier: CLUSTER_ID,
        SkipFinalSnapshot: true,
      }),
    );
    console.log("Cluster delete initiated (may take several minutes).");
  } catch (err: unknown) {
    const code = (err as { name?: string }).name;
    if (code === "DBClusterNotFoundFault") {
      console.log("Cluster already absent:", CLUSTER_ID);
      return;
    }
    throw err;
  }
}

async function deleteSubnetGroup(): Promise<void> {
  try {
    await rds.send(
      new DescribeDBSubnetGroupsCommand({ DBSubnetGroupName: SUBNET_GROUP }),
    );
    console.log("Deleting subnet group:", SUBNET_GROUP);
    await rds.send(
      new DeleteDBSubnetGroupCommand({ DBSubnetGroupName: SUBNET_GROUP }),
    );
  } catch (err: unknown) {
    const code = (err as { name?: string }).name;
    if (code === "DBSubnetGroupNotFoundFault") {
      console.log("Subnet group already absent.");
      return;
    }
    throw err;
  }
}

async function deleteSecurityGroup(vpcId?: string): Promise<void> {
  const filters = vpcId
    ? [
        { Name: "group-name", Values: [SG_NAME] },
        { Name: "vpc-id", Values: [vpcId] },
      ]
    : [{ Name: "group-name", Values: [SG_NAME] }];

  const sgs = await ec2.send(new DescribeSecurityGroupsCommand({ Filters: filters }));
  const sg = sgs.SecurityGroups?.[0];
  if (!sg?.GroupId) {
    console.log("Security group already absent:", SG_NAME);
    return;
  }
  console.log("Deleting security group:", sg.GroupId);
  await ec2.send(new DeleteSecurityGroupCommand({ GroupId: sg.GroupId }));
}

async function main(): Promise<void> {
  const arn = await printCallerIdentity();
  if (isBlockedIdentity(arn)) {
    printWrongAccountHelp();
    process.exit(1);
  }

  console.log("Tearing down HealthCart Aurora resources...");
  await deleteInstance();
  await deleteCluster();
  await deleteSubnetGroup();
  await deleteSecurityGroup();
  console.log("Teardown complete.");
}

main().catch((err: unknown) => {
  const msg = String((err as Error).message ?? err);
  if (msg.includes("AccessDenied")) {
    printWrongAccountHelp();
  }
  console.error(err);
  process.exit(1);
});
