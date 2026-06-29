# HealthCart

**Your Family's Wellness Starts Here.**

AI-powered family grocery engine — a store that reshapes itself around your family's health every week.

- **Live demo:** [healthcart-iota.vercel.app](https://healthcart-iota.vercel.app)
- **Repository:** [github.com/Bhargavi2212/Healthcart](https://github.com/Bhargavi2212/Healthcart)

Works for any market; demo built for US grocery shoppers.

## Stack

| Layer | Service |
|-------|---------|
| App | Next.js 14+ on [Vercel](https://vercel.com) |
| Database | Amazon Aurora PostgreSQL (AWS) |
| ORM | Prisma |
| AI | Google Gemini Flash |

All infrastructure is provisioned and configured from **this repository** — Aurora connection string and API keys go in `.env.local` locally and in Vercel project settings for production.

## Build phases

| Phase | Doc | Hours |
|-------|-----|-------|
| 1 — Foundation | [PHASE_1.md](./PHASE_1.md) | 1–4 |
| 2 — AI Engine | [PHASE_2.md](./PHASE_2.md) | 5–14 |
| 3 — Frontend + Deploy | [PHASE_3.md](./PHASE_3.md) | 15–24 |

Progress and commit log: [PROGRESS.md](./PROGRESS.md)

## Git workflow (required)

**One commit per completed step** — not per phase. Format:

```
<type>(<scope>): <description>
```

Example: `feat(schema): write complete Prisma schema with 11 tables`

After every commit: update `PROGRESS.md` (check the step, add commit hash).

## Quick start

```bash
git clone https://github.com/Bhargavi2212/Healthcart.git
cd Healthcart
npm install
cp .env.example .env.local
# Fill DATABASE_URL (Aurora) and GEMINI_API_KEY — see docs/AWS_SETUP.md
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Docs

- [PROJECT.md](./PROJECT.md) — product overview and architecture
- [docs/AWS_SETUP.md](./docs/AWS_SETUP.md) — Aurora PostgreSQL from AWS Console
- [.cursorrules](./.cursorrules) — Cursor agent rules for this project
