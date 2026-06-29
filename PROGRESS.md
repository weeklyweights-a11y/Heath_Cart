# Build Progress — HealthCart

**Repo:** [github.com/Bhargavi2212/Healthcart](https://github.com/Bhargavi2212/Healthcart)  
**Deploy:** [healthcart-iota.vercel.app](https://healthcart-iota.vercel.app)

## Rules

- One **git commit per completed step** (see each `PHASE_*.md` step).
- After each commit: check the step below and add a row to **Commit log**.
- Push to `origin main` after each step so Vercel stays in sync.

---

## Phase 1 — Foundation (Hours 1-4)

| Step | Task | Done | Commit |
|------|------|:----:|--------|
| 1.1 | Initialize Next.js with TypeScript and Tailwind | [ ] | |
| 1.2 | Configure Tailwind with design tokens | [ ] | |
| 1.3 | Set up Prisma with Aurora PostgreSQL connection | [ ] | |
| 1.4 | Write Prisma schema (11 tables) | [ ] | |
| 1.5 | Run migration | [ ] | |
| 1.6 | Download and process USDA FoodData Central data | [ ] | |
| 1.7 | Create health condition rules JSON | [ ] | |
| 1.8 | Create dietary tag rules JSON | [ ] | |
| 1.9 | Write and run data import scripts | [ ] | |
| 1.10 | Create and seed product catalog (100+ items) | [ ] | |
| 1.11 | Generate dietary tags for all products | [ ] | |
| 1.12 | Download product images | [ ] | |
| 1.13 | Verify all data in Aurora | [ ] | |

## Phase 2 — AI Engine (Hours 5-14)

| Step | Task | Done | Commit |
|------|------|:----:|--------|
| 2.1 | Build Family CRUD API routes | [ ] | |
| 2.2 | Build scoring engine (lib/scoring.ts) | [ ] | |
| 2.3 | Build scoring API route | [ ] | |
| 2.4 | Build natural language context extraction (lib/ai.ts) | [ ] | |
| 2.5 | Build chat API route with Gemini | [ ] | |
| 2.6 | Build quantity calculation logic (lib/quantities.ts) | [ ] | |
| 2.7 | Build basket optimizer (lib/optimizer.ts) | [ ] | |
| 2.8 | Build basket API route | [ ] | |
| 2.9 | Test scoring with Johnson family | [ ] | |
| 2.10 | Test context extraction with natural text | [ ] | |
| 2.11 | Test basket generation with budget constraint | [ ] | |

## Phase 3 — Frontend + Deploy (Hours 15-24)

| Step | Task | Done | Commit |
|------|------|:----:|--------|
| 3.1 | Build design system components | [ ] | |
| 3.2 | Build Family Setup page | [ ] | |
| 3.3 | Build Shop page with product grid and health badges | [ ] | |
| 3.4 | Build Product Detail page with nutrition | [ ] | |
| 3.5 | Build Chat Panel | [ ] | |
| 3.6 | Build Basket page with coverage score | [ ] | |
| 3.7 | Build Landing/Home page | [ ] | |
| 3.8 | Connect all pages to API routes | [ ] | |
| 3.9 | Test the full demo flow | [ ] | |
| 3.10 | Deploy to Vercel | [ ] | |
| 3.11 | Create architecture diagram | [ ] | |
| 3.12 | Record 3-minute demo video | [ ] | |
| 3.13 | Submit hackathon entry | [ ] | |

---

## Commit log

| Date | Step | Hash | Message |
|------|------|------|---------|
| 2026-06-27 | setup | 3262f86 | docs(spec): add project specification and build phases |
| 2026-06-27 | setup | c62b335 | chore(infra): add repo scaffold, AWS guide, and progress tracker |
