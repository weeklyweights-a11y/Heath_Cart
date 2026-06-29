# HealthCart Intelligence Layer v2

Architecture upgrade from point-tally rules to graph + cosine ranking + CSP basket.

## Feature flag

Set `INTELLIGENCE_V2=true` on Vercel or in `.env.local` to enable v2. Default is **v2 on**; set `INTELLIGENCE_V2=false` to revert to v1.

Rollback: set `INTELLIGENCE_V2=false` — instant revert with no data loss.

## Data flow

```
Chat → orchestrator → intent-agent → household-state → graph/traverse
     → hard-filter → hybrid-score → basket-csp → safety-audit → formatter
```

Gemini is used only for intent parsing and response formatting. Product selection and safety are deterministic.

## Tag pipeline (unchanged)

```
USDA NutritionLookup → DietaryTagRule → generate-tags → Product.tags
Clinical KgNode/KgEdge → graph traversal → match Product.tags
```

## Scoring formula (v2)

```
finalScore = 0.45 * nutrient_cosine + 0.30 * graph_match + 0.15 * semantic + 0.10 * seasonal
```

Nutrients are normalized to % of RDA (boost axes) or inverse of limit (sodium, sugar, GI).

## Bootstrap (production)

```bash
npx prisma migrate deploy
npm run import:rules
npm run seed:kg
npm run seed:all
npm run map:foodon
npm run verify:tag-coverage
npm run embed:products   # optional, Phase 5
```

## Environment

| Variable | Purpose |
|----------|---------|
| `INTELLIGENCE_V2` | Enable v2 pipeline |
| `PGVECTOR_ENABLED` | Optional Aurora pgvector embeddings; **default off** uses intent→tag semantic fallback (15% of hybrid score) |
| `GEMINI_API_KEY` | Intent + formatter + optional embeddings |
| `NEO4J_URI` | Phase 7 stub only |

## Semantic layer (15%)

By default, `score_semantic` uses **intent→tag matching** (bbq → `bbq_friendly`, cold → `hydrating`) — no pgvector required.

To enable embeddings: set `PGVECTOR_ENABLED=true`, run `CREATE EXTENSION vector` on Aurora, then `npm run embed:products`.

## Production checklist

```bash
npx prisma migrate deploy
npm run seed:kg
npm run verify:tag-coverage
npm run verify:v2-ready   # KgNode + FoodOn + flag check
```

Set on Vercel: `INTELLIGENCE_V2=true`, `DATABASE_URL`, `GEMINI_API_KEY`.

Product ontology mappings use [FoodOn](https://foodon.org) (CC BY 4.0).

## Implementation philosophy

Follow [`.cursor/rules/ponytail.mdc`](../../.cursor/rules/ponytail.mdc): reuse `scoring.ts`/`optimizer.ts` delegation, minimum new abstractions, `ponytail:` comments on intentional shortcuts.

## Agent vs module

| Name | Type | Role |
|------|------|------|
| intent-agent | LLM-adjacent | Parse chat → ExtractedContext |
| formatter-agent | LLM-adjacent | Format validated basket reply |
| safety-audit | Deterministic | Re-check allergies/vegetarian |
| semantic-retrieval | Deterministic | pgvector or intent fallback |
| basket-csp | Deterministic | Category selection + budget |

## Shipped vs deferred (v2 release)

**Shipped (Phases 0–6):** Postgres knowledge graph, hard-filter, normalized nutrient cosine, hybrid scoring, CSP basket, safety audit, orchestrator, constrained formatter, intent→tag semantic fallback (15%), golden tests, `verify:v2-ready` / `verify:v2-completion`.

**Deferred (Phase 7 stretch — follow-up epic):**

| Item | Status | Notes |
|------|--------|-------|
| pgvector semantic | Not enabled | `PGVECTOR_ENABLED=false`; intent→tag fallback is production default |
| Neo4j Aura sync | Stub | [`neo4j-client.ts`](../src/lib/intelligence/graph/neo4j-client.ts) delegates to Postgres |
| FoodKG USDA subset | Stub | [`import-foodkg-usda-subset.ts`](../data/scripts/import-foodkg-usda-subset.ts) |
| v1 deprecation | Rollback kept | Set `INTELLIGENCE_V2=false` to revert; remove after stable prod |
| Formatter hallucination test | Not automated | Prompt-only guardrails today |

Epic name for later: **Intelligence v2 Phase 7 — stretch**
