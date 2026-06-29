# Devpost Submission — HealthCart

## Description

**AWS Database:** Amazon Aurora PostgreSQL

**Problem:** American families with complex health needs — allergies, chronic conditions, visiting relatives — cannot find a grocery platform that personalizes for everyone in the household.

**Why:** Diet-related disease burden is high in the US; food allergies affect 1 in 13 children.

## Intelligence v2 architecture

HealthCart v2 replaces brittle point-tally rules with:

- **Postgres knowledge graph** (`KgNode`/`KgEdge`) seeded from clinical rules + mood intents
- **Dual-layer tags** — USDA thresholds → `Product.tags`; graph traversal matches tags
- **Normalized nutrient-vector cosine ranking** (boost vs limit axes, GI for diabetes)
- **Hybrid score** — 45% nutrient + 30% graph + 15% semantic + 10% seasonal
- **Hard-constraint CSP basket** with safety audit (allergies, vegetarian, celiac)
- **Gemini** — intent parsing and response formatting only

See [`docs/INTELLIGENCE_V2.md`](docs/INTELLIGENCE_V2.md). FoodOn ontology mappings (CC BY 4.0).

## Links

- **Live app:** https://healthcart-iota.vercel.app
- **Demo video:** _YouTube unlisted URL_
- **Vercel Team ID:** _fill from Vercel dashboard_
- **Architecture diagram:** `/architecture.png`

## Attachments

- [ ] `public/architecture.png`
- [ ] AWS Console screenshot — Aurora PostgreSQL tables

## Repo

https://github.com/Bhargavi2212/Healthcart
