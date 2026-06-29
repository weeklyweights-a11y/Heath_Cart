import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

const REGION = process.env.AWS_REGION ?? "us-west-2";

export function awsProfile(): string {
  return process.env.AWS_PROFILE ?? "default";
}

export async function printCallerIdentity(): Promise<string> {
  const sts = new STSClient({ region: REGION });
  const id = await sts.send(new GetCallerIdentityCommand({}));
  const arn = id.Arn ?? "unknown";
  console.log(`AWS profile: ${awsProfile()}`);
  console.log(`AWS identity: ${arn}`);
  console.log(`Account: ${id.Account ?? "?"}`);
  return arn;
}

/** Block only the old Freshflow user — healthcart-deploy in the same account is allowed. */
export function isBlockedIdentity(arn: string): boolean {
  return arn.includes(":user/Freshflow");
}

export function printWrongAccountHelp(): void {
  console.error(`
Insufficient RDS permissions or wrong IAM user.

Use IAM user healthcart-deploy with HealthCartRDSProvision policy attached.

Follow: docs/AWS_NEW_ACCOUNT.md

Quick fix:
  1. IAM → healthcart-deploy → Security credentials → Create access key (CLI)
  2. Add [healthcart] profile to ~/.aws/credentials (see docs/aws-credentials.example)
  3. PowerShell: $env:AWS_PROFILE = "healthcart"
  4. npm run teardown:aurora
  5. npm run provision:aurora
`);
}
