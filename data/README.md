# HealthCart Data Pipeline

## USDA FoodData Central

- **Source:** https://fdc.nal.usda.gov/download-datasets.html
- **Datasets:** Foundation Foods + SR Legacy (CSV bulk download)
- **Raw files:** `data/usda/raw/` (gitignored)

### foodCode strategy

1. **Primary:** `foodCode = fdc_id` from `food.csv`
2. **Fallback (SR Legacy):** if `fdc_id` missing but `NDB_number` present, `foodCode = NDB_number`
3. Catalog `usdaFoodCode` must match the integer stored in `NutritionLookup`

### Nutrient mapping

See `data/usda/nutrient-id-map.json` for FDC `nutrient_id` → column mapping.

- All values normalized **per 100g**
- **Folate:** FDC reports mcg DFE; import divides by 1000 to store as `folateMg`
- **Glycemic index:** not in FDC; left null; `low_glycemic` uses proxy in tag generator (sugar &lt; 10g, fiber &gt; 2g)

### Processed output

- `data/usda/usda_data.json` — full import output (gitignored, written locally)
- `data/usda/sample.json` — 10-row sample committed for reference

### Open Food Facts

Synthetic `foodCode` range `9_000_000+` for branded items not in USDA. Run `import-openfoodfacts.ts` when ≥3 catalog items fail `resolveUsdaCode()`.

## Health rules sources

- USDA Dietary Guidelines for Americans 2020–2025
- American Heart Association guidelines
- WHO guidance → `source: "published_literature"` with WHO citation in `reason`

## Catalog prices

Typical US grocery retail estimates (2025–2026). Document updates when refreshing catalog.

## Commands

```bash
npm run import-data      # USDA + rules
npm run import:usda      # NutritionLookup only
npm run import:rules     # Health + dietary tag rules
npm run seed:products    # Product catalog
npm run generate:tags    # DietaryTag generation
npm run seed:all         # seed:products + generate:tags
npm run verify:data      # 10-check validation
```

## Vercel / Aurora

- Set `DATABASE_URL` with `connection_limit=1` for serverless
- Deploy migrations: `npx prisma migrate deploy`
- One-time production seed after first deploy:

```bash
DATABASE_URL="postgresql://...production..." npm run import-data
DATABASE_URL="..." npm run seed:all
DATABASE_URL="..." npm run verify:data
```

## Import row count baseline

Logged at end of `import-usda.ts` run. Used by `verify-data.ts` check #1 (≥2,000 or ≥80% of baseline).
