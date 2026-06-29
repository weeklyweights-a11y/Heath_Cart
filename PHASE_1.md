# Phase 1: Foundation
## Hours 1-4

**Goal:** Next.js app running with Prisma connected to Aurora PostgreSQL. All data imported from real sources — USDA FoodData Central nutritional data, health condition rules, dietary tag rules, product catalog with 100+ real American grocery items. Every product has auto-generated dietary tags based on its nutritional profile. Database is the single source of truth.

**Before starting:** You need the Aurora PostgreSQL connection string in .env.local (DATABASE_URL) and a Gemini API key (GEMINI_API_KEY). These are set up manually outside Cursor.

---

## Step 1.1: Initialize Next.js Project
Create a Next.js 14+ app with TypeScript, App Router, and Tailwind CSS. Set up the project structure as defined in .cursorrules Section 3. Create all directories even if empty (add .gitkeep). Install dependencies: prisma, @prisma/client, @google/generative-ai. Create .env.example with DATABASE_URL and GEMINI_API_KEY placeholders.

**Verify:** `npm run dev` starts on localhost:3000 without errors.
**Commit:** `chore(infra): initialize Next.js with TypeScript, Tailwind, and Prisma`

---

## Step 1.2: Configure Tailwind Design Tokens
Set up tailwind.config.ts with the exact color palette:
- primary: #1B5E20 (Forest Green)
- primary-dark: #0D3B0E
- success: #4CAF50 (Light Green)
- accent: #8D6E63 (Gold)
- cream: #FFF8E1
- text: #5D4037 (Warm Gray)
- danger: #E57373 (Soft Red)
- warning: #FFB74D (Soft Orange)

Configure font families: Georgia for headings, Inter for body. Set up the 8px spacing scale. Configure responsive breakpoints at 375px, 768px, 1024px, 1440px.

Set up globals.css with CSS variables matching the Tailwind tokens for runtime access. Import Inter from Google Fonts with font-display: swap and Latin subset.

**Verify:** Create a test page rendering all colors and font sizes. Visual confirmation they match.
**Commit:** `style(ui): configure Tailwind with design tokens and typography`

---

## Step 1.3: Set Up Prisma with Aurora PostgreSQL
Initialize Prisma: `npx prisma init`. Configure the datasource in schema.prisma to use the DATABASE_URL environment variable with the postgresql provider. Create the Prisma client utility at src/lib/db.ts using the singleton pattern (prevent multiple instances in dev).

**Verify:** `npx prisma db pull` connects to Aurora without errors (even if no tables exist yet).
**Commit:** `chore(infra): configure Prisma with Aurora PostgreSQL connection`

---

## Step 1.4: Write Prisma Schema
Write the complete Prisma schema with all 11 tables as defined in .cursorrules Section 6. Use the exact field names, types, and relationships specified. Key details:

Family management: Family, FamilyMember (with conditions and allergies as String arrays, isTemporary flag with optional startDate/endDate for visitors), WeeklyContext (stores raw natural language message AND extracted structured JSON).

Nutrition knowledge: NutritionLookup (foodCode as primary key — USDA NDB/FDC numbers, not auto-generated UUID), HealthConditionRule (condition + action + targetTag + scoreImpact + reason + source), DietaryTagRule (tagName + nutrientColumn + operator + threshold).

Products: Product (with usdaFoodCode foreign key to NutritionLookup; nameTe optional, not required), ProductVariant (weight options with prices in USD), DietaryTag (product + tag string).

AI output: ProductScore (family + product + score + reasoning + badge), BasketRecommendation (family + basketJson + coverageScore + totalPrice + context).

Set up all foreign key relationships, unique constraints (one WeeklyContext per family per week, one DietaryTag per product per tag), and cascade deletes where appropriate (delete family → delete members, scores, baskets).

**Verify:** `npx prisma validate` passes with zero errors.
**Commit:** `feat(schema): write complete Prisma schema with 11 tables`

---

## Step 1.5: Run Migration
Generate and run the Prisma migration against Aurora PostgreSQL: `npx prisma migrate dev --name init`. This creates all 11 tables in the database.

**Verify:** `npx prisma studio` opens and shows all 11 tables (empty). Connect to Aurora directly and run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';` — should return 11+ tables (Prisma adds a _prisma_migrations table).
**Commit:** `feat(schema): run initial migration — all tables created in Aurora`

---

## Step 1.6: Download and Process USDA FoodData Central Data
Download the USDA FoodData Central dataset from the real source. Primary: https://fdc.nal.usda.gov/download-datasets.html — download the "Foundation Foods" and "SR Legacy" datasets (CSV). These cover generic ingredients. 300,000+ foods available in the full database; Foundation Foods + SR Legacy provide the core ingredient set for the demo.

Parse the data and extract every field that maps to the NutritionLookup table columns: foodCode (USDA NDB number), foodGroup, nameEn, energyKcal, proteinG, totalFatG, carbsG, fiberG, sugarG, ironMg, calciumMg, vitaminAUg, vitaminCMg, folateMg, potassiumMg, sodiumMg, saturatedFatG, glycemicIndex.

English names only — no Telugu/Hindi columns in USDA data. Leave nameHi and nameTe null/empty.

If some columns are not directly available in the source (like glycemicIndex), leave them null — they can be enriched later.

Secondary source for branded products: Open Food Facts (https://world.openfoodfacts.org/) — use for packaged/branded items not well covered in Foundation Foods.

Write the import script at data/scripts/import-usda.ts using Prisma to bulk-insert into NutritionLookup. Handle duplicates gracefully (upsert by foodCode).

Save the processed data as a JSON file at data/usda/usda_data.json for reference.

**Verify:**
```sql
SELECT COUNT(*) FROM "NutritionLookup";
-- Should return thousands of entries (Foundation Foods + SR Legacy subset)

SELECT "foodCode", "nameEn", "energyKcal", "proteinG", "ironMg" 
FROM "NutritionLookup" WHERE "nameEn" ILIKE '%spinach%';
-- Should return Spinach with real nutritional values

SELECT "foodGroup", COUNT(*) FROM "NutritionLookup" GROUP BY "foodGroup" ORDER BY COUNT(*) DESC;
-- Should show distribution across food groups
```
**Commit:** `data(usda): download and import USDA FoodData Central nutritional data`

---

## Step 1.7: Create Health Condition Rules
Create health condition rules by researching the USDA Dietary Guidelines for Americans 2020-2025, American Heart Association guidelines, and WHO nutrition guidance. Extract condition-specific food recommendations from these sources.

For each health condition, research what foods should be boosted, limited, or avoided, and document the scientific reasoning. The rules must reference dietary tags (from Step 1.8) that products can be matched against.

Cover these conditions at minimum:

Chronic conditions (source: usda_dietary_guidelines, aha_guidelines, or published_literature):
- diabetes — what foods help manage blood sugar, what spikes it
- cholesterol / dyslipidemia — what reduces LDL, what raises it
- hypertension — sodium-related, potassium-rich foods
- anemia — iron sources, absorption enhancers and inhibitors
- thyroid — iodine, selenium, goitrogens (single condition, not hypo/hyper split)
- obesity — caloric density, fiber, satiety
- pregnancy (trimester 1, 2, 3) — folate, iron, calcium needs change by trimester
- celiac / gluten intolerance — gluten-free foods, avoid wheat/barley/rye
- peanut allergy — peanut-free foods, avoid peanut-containing products
- lactose intolerance — dairy-free alternatives, limit lactose-containing dairy

Temporary conditions (source: published medical literature):
- fever — hydration, easily digestible, vitamin C, avoid heavy foods
- cold / cough — anti-inflammatory, warm foods, hydrating
- stomach upset — BRAT-adjacent foods (banana, rice, applesauce, toast)
- constipation — high fiber, hydrating foods
- period cramps — iron, magnesium, warm foods, anti-inflammatory
- post-surgery recovery — high protein, vitamin C for healing, iron
- fasting — light, easily digestible foods

Do NOT include: pcos, hypothyroid/hyperthyroid as separate conditions, sattvic rules.

For each condition, each rule should have: condition name, action (boost/limit/avoid), targetTag (the dietary tag to match against), scoreImpact (positive for boost, negative for limit/avoid), reason (human-readable, will be shown to customer), source (usda_dietary_guidelines, aha_guidelines, or published_literature), and autoExpireDays for temporary conditions (7 for fever, 5 for cold, etc.).

Write the import script at data/scripts/import-rules.ts. Store rules in data/rules/health_conditions.json.

Do NOT hardcode the rules in the import script — read from the JSON file so rules can be updated without changing code.

**Verify:**
```sql
SELECT condition, COUNT(*) FROM "HealthConditionRule" WHERE "isActive" = true GROUP BY condition ORDER BY condition;
-- Should show 15+ conditions with multiple rules each

SELECT * FROM "HealthConditionRule" WHERE condition = 'diabetes' AND action = 'boost' LIMIT 5;
-- Should show boost rules for diabetes with real reasons

SELECT * FROM "HealthConditionRule" WHERE condition = 'celiac' AND action = 'avoid' LIMIT 3;
-- Should show gluten avoid rules for celiac
```
**Commit:** `data(rules): create and import health condition rules from USDA and AHA guidelines`

---

## Step 1.8: Create Dietary Tag Rules
Create the dietary tag rules that auto-generate tags for products based on their nutritional data. Each rule defines: a tag name, the nutritional column to check (from NutritionLookup), an operator (> or <), and a threshold value.

Research appropriate thresholds from USDA Dietary Reference Intakes (DRI) and nutrition science — not ICMR. Examples of what the rules should cover — determine the actual thresholds by researching what USDA and AHA define as "high" or "low" for each nutrient:

- When is a food considered "iron-rich"? What mg/100g threshold?
- When is a food "high-fiber"? What g/100g?
- What glycemic index value defines "low-glycemic"?
- When is a food "high-protein"?
- What defines "vitamin C rich"?
- When is something "low-calorie"?
- What sodium level makes something "high-sodium"?
- What sugar level is "high-sugar"?
- What calcium threshold for "calcium-rich"?
- What folate level for "folate-rich"?
- What saturated fat level for "high-saturated-fat"?
- gluten_free, dairy_free, peanut_free — categorical tags for allergen-aware scoring

Also include categorical tags that cannot be auto-generated from single nutrient values but need to be assigned based on food group or other logic:
- vegetarian (based on food group — all plant foods)
- easily_digestible (based on food group + fiber content)
- hydrating (based on water content if available, or food group like fruits)
- light_meal, bbq_friendly (contextual tags for weekly mood)

Do NOT include sattvic tag.

Write the import script at data/scripts/import-rules.ts (extend the same script from Step 1.7 or create a separate one). Store rules in data/rules/dietary_tags.json.

The import script should read from the JSON file, NOT have hardcoded values.

**Verify:**
```sql
SELECT COUNT(*) FROM "DietaryTagRule" WHERE "isActive" = true;
-- Should return 15+ rules

SELECT * FROM "DietaryTagRule" ORDER BY "tagName";
-- Should show all rules with appropriate thresholds
```
**Commit:** `data(rules): create and import dietary tag rules with USDA-based thresholds`

---

## Step 1.9: Run All Data Import Scripts
Run the import scripts in order: USDA first (NutritionLookup), then health condition rules, then dietary tag rules. Verify data integrity — health condition rules reference tags that match dietary tag rule names. Fix any mismatches.

Create a master import script or npm script that runs all imports in sequence: `npm run import-data` or `npx tsx data/scripts/import-all.ts`.

**Verify:** All three tables populated. Cross-reference: every targetTag in HealthConditionRule matches a tagName in DietaryTagRule. No orphan references.
**Commit:** `data(import): run all data imports and verify cross-references`

---

## Step 1.10: Create and Seed Product Catalog
Research and create a product catalog of 100+ real American grocery products. Use real product names (English only — nameTe left empty), real price ranges in USD, and real weight options.

Categories to cover:
- Vegetables (14+): kale, spinach, broccoli, bell peppers, sweet potato, zucchini, avocado, tomato, carrots, celery, Brussels sprouts, asparagus, corn, green beans
- Fruits (10+): blueberries, strawberries, bananas, apples, oranges, watermelon, grapes, lemons, peaches, mangoes
- Proteins (10+): chicken breast, ground turkey, salmon, eggs, tofu, Greek yogurt, cottage cheese, black beans, lentils, chickpeas
- Grains (5+): brown rice, quinoa, oats, whole wheat bread, whole wheat pasta, tortillas
- Dairy (7+): milk (whole, 2%, almond, oat), cheese, butter, cream cheese
- Pantry (8+): olive oil, peanut butter, almond butter, honey, marinara sauce, salsa, soy sauce, hot sauce
- Snacks (5+): hummus, trail mix, granola bars, dark chocolate, popcorn

For each product:
- nameEn (English only; nameTe optional and left empty)
- category and subcategory
- description (one line)
- price in USD (research current US grocery prices)
- weight_options as ProductVariants: typical US grocery weights (1 lb, 2 lb for produce; 12 oz, 16 oz for packaged; 32 oz for dairy)
- usdaFoodCode mapping — find the matching entry in the imported NutritionLookup table. Search by English name. If exact match not found, use the closest equivalent.
- isSeasonal flag and availableMonths for seasonal items (peaches: June-August, watermelon: May-August, etc.)

Write the seed script at data/scripts/seed-products.ts. Read from a structured file (JSON or CSV) in data/products/, NOT hardcoded in the script.

**Verify:**
```sql
SELECT category, COUNT(*) FROM "Product" GROUP BY category ORDER BY COUNT(*) DESC;
-- Should show 7 categories totaling 100+ products

SELECT p."nameEn", p.category, n."energyKcal", n."proteinG", n."ironMg"
FROM "Product" p
JOIN "NutritionLookup" n ON p."usdaFoodCode" = n."foodCode"
WHERE p."nameEn" ILIKE '%kale%';
-- Should return Kale with real nutritional values from USDA

SELECT COUNT(*) FROM "ProductVariant";
-- Should return 300+ (each product has 2-4 variants)
```
**Commit:** `data(catalog): seed 100+ real American grocery products with variants and USDA mapping`

---

## Step 1.11: Generate Dietary Tags for All Products
Write a tag generation script that: for each product, looks up its nutritional data via the usdaFoodCode → NutritionLookup join, evaluates every DietaryTagRule against the nutritional values, and creates DietaryTag records for all matching rules.

Also generate categorical tags: check the food group from NutritionLookup — if it's a plant-based food group, add "vegetarian" tag. Check if it's in the dairy or meat/fish/egg groups for non-vegetarian classification. Assign gluten_free, peanut_free, dairy_free tags based on product category and ingredients where applicable.

The script should be idempotent — delete existing tags for a product before regenerating, so it can be re-run safely if rules change.

Run as: `npx tsx data/scripts/generate-tags.ts` or include in the master import script.

**Verify:**
```sql
SELECT tag, COUNT(*) FROM "DietaryTag" GROUP BY tag ORDER BY COUNT(*) DESC;
-- Should show 10+ different tags with counts (e.g., vegetarian: 80+, iron_rich: 15, high_fiber: 20)

SELECT p."nameEn", dt.tag FROM "Product" p
JOIN "DietaryTag" dt ON p.id = dt."productId"
WHERE p."nameEn" ILIKE '%kale%';
-- Kale should have tags like: vegetarian, iron_rich, high_fiber, folate_rich, low_calorie

SELECT p."nameEn", dt.tag FROM "Product" p
JOIN "DietaryTag" dt ON p.id = dt."productId"
WHERE p."nameEn" ILIKE '%quinoa%';
-- Quinoa should have: vegetarian, gluten_free, high_protein, low_glycemic
```
**Commit:** `data(tags): auto-generate dietary tags for all products from nutritional data`

---

## Step 1.12: Download Product Images
For each product in the catalog, find a royalty-free image from Unsplash, Pexels, or Pixabay showing American grocery products. Download and save as WebP format, max 400px width, to public/products/. Name by slug: kale.webp, spinach.webp, quinoa.webp, chicken-breast.webp.

If automated bulk download is possible (using Unsplash API or similar), use it. Otherwise, download a representative set for the most important products (at least 30-40 images covering all categories) and use a category-default image for the rest.

Update the product seed data to reference the correct image filenames.

**Verify:** `ls public/products/ | wc -l` returns 30+ images. Product records have imageUrl populated.
**Commit:** `data(images): download American grocery product images`

---

## Step 1.13: Verify Complete Data Setup
Run a comprehensive verification to ensure all data is properly loaded and cross-referenced:

1. NutritionLookup has thousands of entries (Foundation Foods + SR Legacy)
2. HealthConditionRule has rules for 15+ conditions covering chronic and temporary (including celiac, peanut allergy, lactose intolerance)
3. DietaryTagRule has 15+ rules with USDA-based thresholds
4. Product has 100+ items across 7 categories
5. ProductVariant has 300+ entries (2-4 per product)
6. DietaryTag has 500+ entries (products × matching tags)
7. Every Product has a usdaFoodCode that exists in NutritionLookup
8. Every HealthConditionRule.targetTag matches a DietaryTagRule.tagName or a generated tag
9. Every Product has at least 1 DietaryTag
10. Every Product has at least 1 ProductVariant

Write a verification script that checks all 10 conditions and reports pass/fail.

**Verify:** All 10 checks pass. No orphan references. No products without tags or variants.
**Commit:** `chore(data): verify complete data setup — all cross-references valid`

---

## Phase 1 Complete Checklist

Before moving to Phase 2, ALL of these must be true:

- [ ] Next.js app running with TypeScript and Tailwind
- [ ] Tailwind configured with exact design tokens (colors, fonts, spacing)
- [ ] Prisma connected to Aurora PostgreSQL
- [ ] Schema with 11 tables migrated
- [ ] USDA FoodData Central data imported (Foundation Foods + SR Legacy)
- [ ] Health condition rules imported (15+ conditions, chronic + temporary, including celiac and peanut allergy)
- [ ] Dietary tag rules imported (15+ rules with USDA-based thresholds)
- [ ] 100+ real American grocery products seeded with USD prices
- [ ] 300+ product variants (weight options with prices)
- [ ] 500+ dietary tags auto-generated from nutritional data
- [ ] Product images downloaded (30+)
- [ ] All cross-references verified (products → USDA, rules → tags, products → tags)
- [ ] All steps committed individually
- [ ] PROGRESS.md updated
