# Phase 2: AI Engine
## Hours 5-14

**Goal:** The complete AI brain is working. A family's health profiles + natural language weekly context → every product in the catalog scored with personalized reasoning → an optimized grocery basket with calculated quantities and coverage score. The customer types naturally about their family's week in English or Spanish, and the system extracts structured context, re-scores everything, and generates a designed grocery basket.

**Prerequisite:** Phase 1 complete — Aurora has all data: USDA FoodData Central foods, 15+ health condition rules, 15+ dietary tag rules, 100+ products with variants and auto-generated dietary tags. Prisma client working.

---

## Step 2.1: Build Family CRUD API Routes
Build API routes for managing family profiles.

POST /api/family — create a family (name). Returns family with id.

GET /api/family/[id] — get family with all members.

POST /api/family/[id]/members — add a family member. Accepts: name, age, relation (self/spouse/child/parent/grandparent/sibling/other), dietType (vegetarian/non_vegetarian/flexible), conditions (string array — diabetes, anemia, thyroid, celiac, peanut_allergy, etc.), allergies (string array), heightCm, weightKg. Also accepts isTemporary flag with optional startDate/endDate for visitors.

PUT /api/family/[id]/members/[memberId] — update a member.

DELETE /api/family/[id]/members/[memberId] — remove a member.

All responses return the full family with all members so the frontend always has the latest state.

Create a test family for development — the Johnson family: Dad Mike (age 52, high cholesterol, pre-diabetic), Mom Sarah (age 48, healthy, weight management), Son Jake (age 14, peanut allergy, athletic), Grandma Linda (visiting, celiac disease). Store this as a seed script that can be run to quickly set up the test family.

**Verify:** Create the Johnson family via API. Get family — returns all 4 members with conditions. Add a temporary member (visiting aunt, lactose intolerant) — returns 5 members. Delete the aunt — returns 4.
**Commit:** `feat(family): build family and member CRUD API routes`

---

## Step 2.2: Build Scoring Engine
Build the core scoring algorithm at src/lib/scoring.ts.

This is the most important piece of the entire project. It is pure TypeScript. It makes zero external API calls. It is deterministic — same input always produces same output.

The function takes a familyId. It:

1. Loads all family members (permanent + temporary where isTemporary=true and current date is between startDate and endDate)
2. Loads the active weekly context for this family (if any) — this contains additional temporary health states and mood extracted from natural language
3. Merges all conditions: each member's chronic conditions from their profile + any temporary health states from the weekly context that apply to specific members
4. Loads all active health condition rules from the database
5. Loads all products with their dietary tags (join Product → DietaryTag)
6. For each product, calculates a score:
   - Initialize score to 0 and an empty reasons array
   - For each member (permanent + temporary + weekly context temporary members):
     - For each condition this member has:
       - Find all rules matching this condition
       - For each rule: check if the product has the matching dietary tag
       - If match: add the rule's scoreImpact to the score, add a reason string using THE ACTUAL MEMBER NAME and the rule's reason field
   - If cuisine mood exists in weekly context: check if product belongs to categories or has tags associated with that cuisine. Boost score but never override health constraints
   - Determine badge: based on final score thresholds (research appropriate thresholds — when is something "recommended" vs "neutral" vs "limit" vs "avoid")
   - Products with avoid-action matches for ANY member get "avoid" badge regardless of positive scores from other members (safety first)

7. Returns array of {productId, score, badge, reasoning[]} sorted by score descending

The reasoning array contains strings like "Iron-rich — recommended for Mike's cholesterol management. High fiber helps lower LDL." NOT "recommended for family member with cholesterol." Every reason uses the member's actual name.

Handle edge cases:
- Family with zero members: return all products with neutral scores
- All members healthy (no conditions): return products sorted by general nutritional value and seasonal availability
- Conflicting needs: one member needs iron-rich (anemia), another needs to limit iron (hemochromatosis if present). Score reflects the net, reasoning explains both perspectives
- Temporary visitor adds new conditions: their conditions are weighted equally with permanent members
- Weekly context has health states (fever, cold): treated exactly like chronic conditions for scoring purposes
- Celiac/gluten intolerance: products with gluten get "avoid" for Linda
- Peanut allergy: peanut products get "avoid" for Jake

**Verify:** Score products for the Johnson family. Kale should score high (fiber for Mike's cholesterol). Quinoa should score high (gluten-free for Linda, high protein, low glycemic for Mike). Products with gluten get "avoid" for Linda. Peanut products get "avoid" for Jake. White bread should score low for pre-diabetic Mike (high glycemic). Reasoning should say "Mike," "Jake," and "Linda" by name. Run scoring twice with same input — results identical (deterministic).
**Commit:** `feat(scoring): implement family health scoring algorithm with personalized reasoning`

---

## Step 2.3: Build Scoring API Route
Build GET /api/score?familyId={id} — calls the scoring engine function and returns scored products. Optional query parameter: category (filter results by product category). Response includes: total products scored, products array with id, name, category, price (cheapest variant), imageUrl, score, badge, reasoning[].

Also build GET /api/products?familyId={id} — product listing endpoint that returns products sorted by health score for the given family (if familyId provided) or by default order (if not). Include: pagination (limit/offset), category filter, search (nameEn). Each product in the response includes its health badge and short reasoning if familyId is provided.

**Verify:** GET /api/products?familyId={johnsonId}&category=vegetables — returns vegetables sorted by health relevance for Johnson family. Kale near top, high-glycemic items lower. Each product has badge and reasoning.
**Commit:** `feat(scoring): build scoring and product listing API routes`

---

## Step 2.4: Build Natural Language Context Extraction
Build the AI context extraction at src/lib/ai.ts.

This is where the LLM earns its keep. The customer types a natural message about their family's week — in English, Spanish, or any mix. The LLM extracts structured data from it.

Use Google Gemini Flash via the @google/generative-ai SDK.

Build an extraction function that:

1. Takes the raw message text + the current family member list (so the LLM knows who "Jake" and "Linda" refer to)
2. Sends to Gemini with a carefully crafted prompt that instructs it to extract structured JSON with these categories:
   - household_changes: new temporary members arriving or existing ones leaving, with any health conditions mentioned
   - health_states: temporary health conditions for specific family members (fever, cold, cough, stomach issue, etc.). The LLM must map mentioned names or references ("my son," "the kid," "Jake") to actual family member names
   - dietary_needs: any day-specific or event-specific dietary requirements (BBQ Saturday, Thanksgiving, meal prep Sunday, potluck, Super Bowl party)
   - mood: overall cuisine/cooking preference for the week and the reason
   - practical_needs: any grocery restocking needs mentioned ("running low on olive oil," "need more oats")
3. The LLM responds with ONLY the structured JSON — no conversational text in this step
4. Parse and validate the JSON — ensure referenced member names match actual family members, conditions match known health conditions

The prompt must handle:
- English and Spanish: "Solo esta semana somos dos, Sarah llevó a los niños a casa de la abuela"
- Implicit references: "the kid is not well" → map to Jake
- Multiple pieces of info in one sentence: "Linda's sister is visiting, she also has lactose intolerance, and Jake caught a cold at school"
- Vague health descriptions: "not feeling well" → map to general illness, "tummy issue" → stomach_upset
- US cultural context: "Saturday we're doing a BBQ," "meal prep Sunday," "keto this week," "July 4th cookout," "Super Bowl party," "it's too hot" → preference for cooling/light foods
- American food names in responses: kale not palak, lentils not dal, Greek yogurt not curd

Build a second function for conversational response generation:
1. Takes the extracted context + the updated scores/basket + the customer's original message
2. Sends to Gemini with a prompt that instructs it to respond naturally, warmly, acknowledging what the customer said, explaining how the store has adapted, and optionally suggesting next steps
3. The response should use family member names, reference specific products by American names, and feel like talking to a knowledgeable friend — not a medical system

**Verify:** Test with these inputs:
- "My mom Linda is visiting from Florida, she can't have gluten. Jake has a summer cold. It's going to be super hot, want light fresh meals. Saturday we're doing a BBQ."
  → Should extract: temp member (Linda, celiac), health state (Jake, cold), dietary need (Saturday, bbq), mood (light_fresh, hot_weather)

- "Solo esta semana somos dos, Sarah llevó a los niños a casa de la abuela"
  → Should extract: household change (only Mike and Linda this week, Sarah and Jake away)

- "Actually Jake is feeling better"
  → Should extract: remove health state (Jake cold cleared)

- "Linda left yesterday"
  → Should extract: remove temp member (Linda)

**Commit:** `feat(ai): build natural language context extraction with Gemini Flash`

---

## Step 2.5: Build Chat API Route
Build POST /api/chat — accepts {familyId, message}. Orchestrates the full flow:

1. Load current family data
2. Call context extraction (Step 2.4) on the message
3. Apply extracted context: create/update/remove temporary members in the database, create/update/remove temporary health states, save mood and dietary needs in WeeklyContext
4. Re-run the scoring engine (Step 2.2) with the updated family context
5. Generate the optimized basket (Step 2.7 — if built, otherwise skip basket for now)
6. Generate conversational response (Step 2.4 response function) using the updated scores as context
7. Return: {response (conversational text), extractedContext (the structured JSON), updatedScores (re-scored products), basket (if available)}

The frontend can use the updatedScores to immediately re-render the product grid with new sorting and badges — the store transforms in response to the chat message.

Handle follow-up messages: load the existing WeeklyContext and append to it, don't replace. If the customer first said "Jake has a cold" and then says "also we want BBQ this Saturday," both should be active.

Handle corrections: if the customer says "actually Jake is feeling better," remove the cold state. The LLM should understand corrections and negations.

**Verify:** Send the multi-part message about Linda visiting + Jake's cold + BBQ + hot weather. Response acknowledges everything naturally. Scores updated — hydrating foods boosted, gluten-free items tagged for Linda, light foods boosted. Send follow-up "actually Jake is feeling better" — cold state removed, scores adjust back.
**Commit:** `feat(chat): build chat API with context extraction, scoring, and conversation`

---

## Step 2.6: Build Quantity Calculation Logic
Build src/lib/quantities.ts — pure functions for calculating recommended grocery quantities.

Research USDA Dietary Guidelines / DRI for Americans to determine base per-person weekly consumption by food category. Americans typically consume less vegetables per person than ICMR recommends for Indians — derive values from USDA sources, not hardcoded constants. Key factors:

**Family size scaling:** total quantity scales with number of active family members this week (permanent + temporary visitors minus any members who are away). If the customer said "only two of us this week," quantities should reflect 2 people, not the usual 4.

**Nutritional gap contribution:** each product should contribute meaningfully to the family's nutritional gaps. Calculate: what's the family's total weekly need for each key nutrient (based on member ages, genders, conditions — research RDA values from USDA for different demographics). What do the monthly staples already cover? The gap is what weekly groceries need to fill. Each product's recommended quantity should fill a reasonable share (not 100%) of the relevant nutrient gap.

**Shelf life awareness:** build a shelf life reference for common US grocery categories — bagged salad 3-5 days, root vegetables full week, dairy per USDA storage guidance. Don't recommend more of a perishable item than a family can consume before it spoils.

**Variant snapping:** calculated quantities must snap to available ProductVariant weight options. If calculated quantity is between two variants, determine the better snap direction based on context (round up if nutritional need is high, round down if budget is tight).

**Budget constraint:** if a target budget is provided (e.g. "keep it under $75"), scale quantities down starting from lowest-priority items (mood-driven items first, then variety items, last to cut are health-critical items that address serious conditions like anemia or diabetes).

The function takes: family members (with ages and conditions), nutritional gaps, product with its nutrition data, available variants, shelf life data, and optional budget. Returns: recommended variant and quantity with reasoning.

**Verify:** Calculate quantities for the 4-person Johnson family. Kale should be around USDA-based weekly consumption for leafy greens, snapped to the nearest variant (e.g. 1 lb bag). Reduce family to 2 people — quantities roughly halve. Add budget constraint $60 — lower-priority items reduce first.
**Commit:** `feat(quantities): build quantity calculation with USDA RDA, shelf life, and budget logic`

---

## Step 2.7: Build Basket Optimizer
Build src/lib/optimizer.ts — takes the family's scored products and produces a complete, designed grocery basket.

Input: familyId, scored products from the scoring engine, optional budget constraint.

Algorithm:
1. Group scored products by category
2. Select top-scored products per category — research how many items per category makes a typical American weekly grocery basket (a family doesn't buy 15 vegetables, they buy 6-8)
3. For each selected product, calculate quantity using the quantity logic (Step 2.6)
4. Calculate the basket's total nutritional contribution: sum up all nutrients from all items at their recommended quantities
5. Calculate per-member coverage: for each family member, what percentage of their weekly nutritional targets (from USDA DRI for their age/gender/condition) does this basket cover? Research these RDA values from USDA guidelines.
6. Calculate overall coverage score: average of per-member coverages, weighted by health severity (a pre-diabetic member's coverage matters more than a healthy member's)
7. If any member's coverage for a critical nutrient is below an acceptable threshold, find products that fill the gap and add them
8. If budget constraint exists: remove or reduce lower-priority items until under budget. Recalculate coverage. Return both the optimized basket and the coverage tradeoff.
9. Apply weekly context: if cuisine mood is set (BBQ, meal prep), ensure the basket has ingredients appropriate for that context. If practical needs mentioned ("need olive oil"), include those items even if they weren't top-scored.
10. Calculate total price from selected variants (USD)

Output: items array (productId, name, quantity, variant, price, reasoning, which members benefit), coverageScore (overall), perMemberCoverage (per member with name and percentage), totalPrice, weeklyContext summary.

**Verify:** Generate basket for Johnson family with "BBQ" mood. Basket should have items across categories, quantities appropriate for 4 people, coverage score calculated, per-member breakdown shows each member by name. Generate again with budget $75 — basket is smaller, coverage lower, reasoning explains tradeoffs. Generate with "only Mike and Linda this week" — basket is smaller, focused on cholesterol/diabetes/celiac.
**Commit:** `feat(optimizer): build basket optimizer with coverage scoring and budget constraints`

---

## Step 2.8: Build Basket API Route
Build POST /api/basket — accepts {familyId, budget (optional)}. Runs the scoring engine, then the basket optimizer. Returns the full basket with items, quantities, coverage score, per-member coverage, total price, and the weekly context that generated it.

Build PUT /api/basket/adjust — accepts {familyId, basketId, adjustments: [{productId, newQuantity or "remove"}]}. Recalculates coverage score after the adjustment and returns updated basket. This powers the real-time coverage updates when a customer changes quantities in the basket view.

**Verify:** Generate basket. Adjust a quantity — coverage recalculates. Remove an item — coverage drops, response shows which member's needs are less covered.
**Commit:** `feat(basket): build basket API with generation and real-time adjustment`

---

## Step 2.9: Test Scoring with Johnson Family
Run comprehensive scoring tests:

1. Base scoring (no weekly context): kale high (fiber for Mike's cholesterol), quinoa high (gluten-free, high protein, low glycemic), white bread low (high glycemic for pre-diabetic Mike), peanut butter gets "avoid" for Jake
2. Add temporary visitor (Linda with celiac): gluten-containing products get "avoid" for Linda
3. Add cold for Jake: hydrating/vitamin C foods boost, heavy items deprioritize
4. Add "BBQ" mood: grill-friendly items boost, but health constraints still override mood
5. Change to "only 2 people" (Mike + Linda): scores recalculate without Jake's peanut allergy influence, cholesterol/diabetes/celiac become dominant constraints
6. Remove all context: scores return to base chronic-only scoring

Document results for each test case.

**Verify:** All 6 test scenarios produce expected results. Reasoning uses correct member names throughout.
**Commit:** `test(scoring): verify scoring across 6 family context scenarios`

---

## Step 2.10: Test Context Extraction
Test the AI context extraction with varied natural language inputs:

1. Full English: "My mom Linda is visiting from Florida, she can't have gluten. Jake has a summer cold. Saturday we're doing a BBQ. It's going to be super hot, want light fresh meals."
2. Spanish: "Solo esta semana somos dos, Sarah llevó a los niños a casa de la abuela"
3. Correction: "Actually Jake is feeling better"
4. Removal: "Linda left yesterday"
5. Vague input: "Not feeling great this week, want something simple and light"
6. Multiple updates in one message: "Linda's sister also came, she's lactose intolerant. And we ran out of olive oil and oats."
7. US cultural: "Meal prep Sunday — need high protein options for Jake's sports week. Mike wants to keep it keto-friendly."

Verify each produces correct structured extraction.

**Verify:** All 7 inputs produce valid structured JSON. Member names mapped correctly. Conditions mapped to known health conditions. Corrections and removals handled.
**Commit:** `test(ai): verify natural language context extraction across 7 input scenarios`

---

## Step 2.11: Test Basket with Budget Constraint
Test the basket optimizer:

1. Generate full basket (no budget) — check coverage score, per-member breakdown, total price in USD
2. Apply budget $75 — basket should reduce, lower-priority items cut first, coverage drops with explanation
3. Apply budget $50 — aggressive reduction, only health-critical items remain, coverage significantly lower
4. Change family to 2 people — quantities and items reduce proportionally
5. Add cold context for Jake — basket includes cold-friendly items, possibly changes some quantities
6. Add BBQ requirement for Saturday — BBQ-friendly items included, basket accommodates

**Verify:** All 6 scenarios produce valid baskets with correct quantities, prices, and coverage calculations.
**Commit:** `test(optimizer): verify basket generation across 6 constraint scenarios`

---

## Phase 2 Complete Checklist

Before moving to Phase 3, ALL of these must be true:

- [ ] Family CRUD API working (create, read, add/update/delete members)
- [ ] Johnson test family seeded and usable
- [ ] Scoring engine producing correct scores for all products against family health profiles
- [ ] Scores use actual family member names in reasoning
- [ ] Temporary visitors and health states affect scoring correctly
- [ ] Celiac and peanut allergy produce correct "avoid" badges
- [ ] Cuisine mood influences scoring without overriding health constraints
- [ ] Badge assignment correct (recommended/neutral/limit/avoid)
- [ ] Avoid badge always wins regardless of positive scores (safety)
- [ ] Product listing API returns products sorted by health score with badges
- [ ] Natural language context extraction working in English and Spanish
- [ ] Context extraction handles: new visitors, health states, dietary needs, mood, practical needs, corrections, removals
- [ ] Chat API orchestrates: extract → update family → re-score → respond
- [ ] Follow-up messages append to context, don't replace
- [ ] Quantity logic considers family size, nutritional gaps, shelf life, variant snapping, budget (USDA RDA)
- [ ] Basket optimizer produces complete basket with coverage score and per-member breakdown
- [ ] Basket adjusts when quantities changed — coverage recalculates
- [ ] Budget constraint reduces basket intelligently (mood items first, health items last)
- [ ] All 6 scoring test scenarios pass
- [ ] All 7 context extraction test scenarios pass
- [ ] All 6 basket test scenarios pass
- [ ] All steps committed individually
- [ ] PROGRESS.md updated
