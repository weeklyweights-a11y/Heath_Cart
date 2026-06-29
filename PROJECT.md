# AI-Powered Family Grocery Engine

**Your Family's Wellness Starts Here.**

An intelligent grocery shopping platform where the store adapts to your family's
health needs — every week, every conversation.

## What This Is

A grocery store where every product knows your family's health. Not a health app.
Not a recipe recommender. A real grocery shopping experience enhanced by AI that
understands your family.

## How It Works

1. **Set up your family** — Add members with their health conditions (diabetes,
   anemia, thyroid, etc.). Quick and simple.

2. **Tell us about your week** — Type naturally: "My mom Linda is visiting from
   Florida, she can't have gluten. Jake has a summer cold. Saturday we're doing a
   BBQ." The AI understands everything from one message.

3. **Shop a store that knows you** — Products are sorted by relevance to YOUR
   family THIS WEEK. Health badges show what's good and what to limit. A suggested
   basket covers 87% of your family's nutritional needs with calculated quantities.

4. **The store changes every week** — New visitors, temporary illness, different
   cuisine mood, weather changes — the store adapts. Same family, different week,
   different shopping experience.

## What Makes It Different

Every grocery platform sells the same products to everyone. This platform
understands that a family with a dad managing high cholesterol, a son with a peanut
allergy, a visiting grandma with celiac disease, and a kid with a summer cold THIS
WEEK needs a completely different grocery basket than the same family NEXT WEEK when
the kid is better and grandma has gone home.

Works for any market; demo built for US grocery shoppers.

The AI doesn't replace shopping — it makes every shopping decision smarter.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (TypeScript, App Router) |
| Styling | Tailwind CSS |
| Database | Amazon Aurora PostgreSQL |
| ORM | Prisma |
| AI/LLM | Google Gemini Flash |
| Deploy | Vercel |

## Data Sources

- **USDA FoodData Central**: 300,000+ foods with 20+ nutritional components.
  Foundation Foods + SR Legacy datasets for generic ingredients. English names only.
- **USDA Dietary Guidelines 2020-2025 + AHA + WHO**: Condition-specific food
  recommendations for diabetes, celiac, peanut allergy, hypertension, and more.
- **Open Food Facts**: Secondary source for branded/packaged products.
- **Product Catalog**: 100+ real American grocery products with USD prices.

## AI Architecture

**The LLM is the ears and the mouth. The scoring engine is the brain.**

```
Customer types natural text
        ↓
[Gemini Flash] extracts structured context
(temp visitors, health states, mood, needs)
        ↓
[Scoring Engine] re-scores all products
(pure TypeScript, deterministic, no LLM)
        ↓
[Basket Optimizer] builds weekly grocery list
(quantities based on family size, nutrition gaps, shelf life)
        ↓
[Gemini Flash] generates conversational response
(explains changes, answers questions)
        ↓
Store UI updates — products re-sort, badges change, basket rebuilds
```

## Deployment

| Service | URL / repo |
|---------|------------|
| GitHub | [github.com/Bhargavi2212/Healthcart](https://github.com/Bhargavi2212/Healthcart) |
| Vercel | [healthcart-iota.vercel.app](https://healthcart-iota.vercel.app) |
| Aurora | AWS RDS — setup in [docs/AWS_SETUP.md](./docs/AWS_SETUP.md) |

Push to `main` after every phase step. Vercel auto-deploys from GitHub.

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Add: DATABASE_URL (Aurora connection string)
# Add: GEMINI_API_KEY

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Import data
npx tsx data/scripts/import-usda.ts
npx tsx data/scripts/import-rules.ts
npx tsx data/scripts/seed-products.ts

# Start dev server
npm run dev
```

## Architecture

```
┌──────────────────────────────────────────┐
│              Vercel (Next.js)              │
│                                           │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Shop   │  │  Basket  │  │  Chat   │ │
│  │  Page   │  │  Page    │  │  Panel  │ │
│  └────┬────┘  └────┬─────┘  └────┬────┘ │
│       │             │             │       │
│  ┌────┴─────────────┴─────────────┴────┐ │
│  │         Next.js API Routes          │ │
│  │                                     │ │
│  │  /api/products  → Scored product    │ │
│  │  /api/score     → Scoring engine    │ │
│  │  /api/basket    → Basket optimizer  │ │
│  │  /api/chat      → AI conversation  │ │
│  │  /api/family    → Family profiles   │ │
│  └────┬──────────────────────┬─────────┘ │
│       │                      │           │
└───────┼──────────────────────┼───────────┘
        │                      │
   ┌────┴────┐           ┌────┴────┐
   │ Aurora  │           │ Gemini  │
   │ Postgre │           │ Flash   │
   │ SQL     │           │ API     │
   │         │           │         │
   │ • USDA  │           │ • NLU   │
   │ • Rules │           │ • Chat  │
   │ • Prods │           │         │
   │ • Family│           │         │
   └─────────┘           └─────────┘
```
