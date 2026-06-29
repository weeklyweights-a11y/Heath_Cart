# Start fresh — new AWS setup for HealthCart

Use this when the wrong AWS account or IAM user is configured (e.g. `Freshflow` without RDS access).

**HealthCart AWS account email:** `bhargavinallapuneni89@gmail.com`  
**Do not use:** RITWIT Docker Postgres or the `Freshflow` IAM user for HealthCart.

---

## 1. Sign in to the correct AWS account

1. Open [AWS Console](https://console.aws.amazon.com/) → sign out if you see the wrong account.
2. Sign in with **bhargavinallapuneni89@gmail.com** (or the account that owns HealthCart).
3. Confirm top-right account alias / account ID is **not** the old Freshflow-only account unless you add RDS permissions there.

---

## 2. Create a dedicated IAM user for HealthCart

1. **IAM** → **Users** → **Create user**
2. User name: `healthcart-deploy`
3. **Attach policies directly** → **Create policy** → JSON → paste contents of  
   [`infrastructure/aws/healthcart-rds-policy.json`](../infrastructure/aws/healthcart-rds-policy.json)
4. Name the policy `HealthCartRDSProvision` → create → attach to `healthcart-deploy`
  5. **Security credentials** → **Create access key** → **CLI** → save Access Key ID + Secret (console password is not used by scripts)

---

## 3. Replace local AWS credentials (remove old default)

Edit `C:\Users\bharg\.aws\credentials`:

```ini
[healthcart]
aws_access_key_id = AKIA...YOUR_NEW_KEY
aws_secret_access_key = ...YOUR_NEW_SECRET
```

Edit `C:\Users\bharg\.aws\config`:

```ini
[profile healthcart]
region = us-west-2
output = json
```

Optional: remove or comment out the old `[default]` **Freshflow** keys so HealthCart scripts never hit the wrong account.

---

## 4. Tear down any old HealthCart RDS resources

From the `healthcart` repo root, with the **healthcart** profile:

```powershell
cd d:\RITWIT_WEB\healthcart
$env:AWS_PROFILE = "healthcart"
npm run teardown:aurora
```

This deletes (if they exist):

- `healthcart-instance-1` (DB instance)
- `healthcart-cluster` (Aurora cluster)
- `healthcart-subnet-group`
- `healthcart-aurora-sg` (security group)

Wait until RDS console shows no `healthcart-*` resources.

---

## 5. Create new Aurora cluster

```powershell
$env:AWS_PROFILE = "healthcart"
npm run provision:aurora
```

Takes about **5–10 minutes**. On success:

- `.env.local` is updated with `DATABASE_URL` and `HEALTHCART_DB_PASSWORD`
- Copy `DATABASE_URL` to **Vercel** → Project **healthcart** → Settings → Environment Variables (Production, Preview, Development)

```powershell
npx vercel env add DATABASE_URL production
# paste value from .env.local when prompted
```

---

## 6. Run Prisma migrations and data import

```powershell
npx prisma migrate deploy
npm run import-data
npm run seed:all
npm run verify:data
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `AccessDenied` on `rds:DescribeDBClusters` | Wrong IAM user — use `healthcart-deploy` keys with `AWS_PROFILE=healthcart` |
| `No default VPC` | Enable default VPC in VPC console for `us-west-2`, or change region in config |
| Vercel build fails on DB | Add `DATABASE_URL` to Vercel env vars and redeploy |
| Still connecting to `localhost:5432` | Remove ritwit URL from `.env.local`; use Aurora URL only |

---

## Cost

- Aurora Serverless v2 (0.5–2 ACU) ≈ low cost for demo; **delete cluster** when idle: `npm run teardown:aurora`
