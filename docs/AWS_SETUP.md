# AWS Aurora Setup (from this repo)

HealthCart uses **Amazon Aurora PostgreSQL** as the only AWS service. Provision and connect it from this project — no separate infra repo.

> **Important:** HealthCart does **not** use the RITWIT monorepo Docker Postgres (`ritwit-postgres` on `localhost:5432`). That database belongs to the separate `RITWIT_WEB` project. HealthCart must use its own Aurora cluster and database name `healthcart`.

**AWS account:** Sign in at [AWS Console](https://console.aws.amazon.com/) with the email used for this project (e.g. `bhargavinallapuneni89@gmail.com`).

**Vercel deploy:** [healthcart-iota.vercel.app](https://healthcart-iota.vercel.app) — set `DATABASE_URL` in Vercel before the app can read/write data.

**Starting fresh (wrong AWS account / no RDS access):** follow [AWS_NEW_ACCOUNT.md](./AWS_NEW_ACCOUNT.md) — create IAM user `healthcart-deploy`, run `npm run teardown:aurora`, then `npm run provision:aurora` with `AWS_PROFILE=healthcart`.

## 1. Create Aurora cluster (AWS Console)

1. Sign in to [AWS Console](https://console.aws.amazon.com/) → **RDS** → **Create database**.
2. **Engine:** Amazon Aurora → **Aurora PostgreSQL** (compatible with PostgreSQL 15+).
3. **Templates:** Dev/Test for hackathon; Production if you need HA later.
4. **DB cluster identifier:** `healthcart-cluster` (or your choice).
5. **Credentials:** master username + strong password — save these.
6. **Instance:** `db.t3.medium` or `db.t4g.medium` is enough for demo.
7. **Connectivity:**
   - **Public access:** Yes (simplest for Vercel + local dev during hackathon).
   - **VPC security group:** allow inbound **TCP 5432** from your IP and `0.0.0.0/0` only if you accept public DB risk for demo; prefer restricting to Vercel IPs or use RDS Proxy later.
8. **Database name:** `healthcart`.
9. Create database. Note the **cluster endpoint** (writer), e.g.  
   `healthcart-cluster.cluster-xxxxx.us-east-1.rds.amazonaws.com`.

## 2. Connection string

```bash
postgresql://MASTER_USER:MASTER_PASSWORD@CLUSTER_ENDPOINT:5432/healthcart?sslmode=require
```

Put in:

| Where | File / UI |
|-------|-----------|
| Local dev | `.env.local` (copy from `.env.example`) |
| Production | Vercel → Project **Healthcart** → Settings → Environment Variables |

Vercel variables (all environments):

| Name | Value |
|------|--------|
| `DATABASE_URL` | Aurora connection string above |
| `GEMINI_API_KEY` | From [Google AI Studio](https://aistudio.google.com/apikey) |

Redeploy Vercel after changing env vars.

**If `vercel env ls` shows no variables:** add `DATABASE_URL` and `GEMINI_API_KEY` in the Vercel dashboard (Settings → Environment Variables) for Production, Preview, and Development, then run `npx vercel env pull .env.local` locally.

## 3. Run migrations from this repo

```bash
cd Healthcart   # this repository root
npm install
npx prisma generate
npx prisma migrate deploy    # production / Vercel build
# or for first dev migration:
npx prisma migrate dev --name init
```

Import scripts (Phase 1): `npm run import-data` once implemented.

## 4. Verify connection

```bash
npx prisma db execute --stdin <<< "SELECT 1;"
# or
npx prisma studio
```

## 5. Vercel ↔ GitHub

- Repo: [Bhargavi2212/Healthcart](https://github.com/Bhargavi2212/Healthcart)
- Deploy URL: [healthcart-iota.vercel.app](https://healthcart-iota.vercel.app)
- Root directory: `/` (this repo is the full Next.js app — not a monorepo subfolder)
- Build command: `npm run build` (default)
- Install command: `npm install && npx prisma generate`

## 6. Security checklist (before public demo)

- [ ] Rotate master password if it was ever committed
- [ ] `.env.local` is in `.gitignore` (already)
- [ ] Vercel env vars marked sensitive
- [ ] Consider AWS Secrets Manager for production beyond hackathon

## 7. Cost control

- Stop or delete Aurora cluster when not building
- Use smallest instance for demo
- Enable **Stop temporarily** on dev clusters when idle (Aurora Serverless v2 optional)

All AWS work for HealthCart happens in this repository: env vars → Prisma → Aurora. No Docker, no separate backend service.
