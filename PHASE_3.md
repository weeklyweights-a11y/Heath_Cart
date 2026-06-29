# Phase 3: Frontend + Deploy
## Hours 15-24

**Goal:** A fully functional, deployed grocery store where the shopping experience transforms based on natural conversation about the family's week. A judge opens the URL, sets up a family, types about their week, watches the store change, sees an optimized basket with coverage scores, and understands immediately that no other grocery platform does this. Deployed on Vercel, running against Aurora PostgreSQL, demo video recorded and submitted.

**Prerequisite:** Phase 2 complete — all API routes working (family, products, scoring, chat, basket). Scoring engine tested across multiple scenarios. Context extraction handles natural English and Spanish input. Basket optimizer produces designed baskets with quantities and coverage.

---

## Step 3.1: Build Design System Components
Build the reusable UI components that every page needs. All built with Tailwind utilities, no component libraries.

**Button:** primary (Forest Green bg, white text), secondary (white bg, green border), accent (Gold bg), ghost (transparent, green text). All with 8px radius, hover/active states, loading spinner state. Minimum touch target 48px.

**ProductCard:** white bg, 8px radius, subtle shadow. Product image, name (English only), price ($X,XXX.XX US format), health badge (colored pill — green/orange/red based on score). Add to basket button or quantity selector. The badge is the key differentiator — it must be visually prominent.

**HealthBadge:** pill-shaped component. Green (#E8F5E9 bg, #1B5E20 text) for recommended. Orange (#FFF3E0 bg, #E65100 text) for limit. Red (#FFEBEE bg, #C62828 text) for avoid. Shows the short reasoning on tap/hover as tooltip: "Good for Jake — peanut-free."

**BasketItem:** product image thumbnail, name, quantity with +/- buttons, price, per-item reasoning text (italic, smaller), remove button.

**CoverageGauge:** circular or semicircular gauge showing overall coverage percentage. Color transitions: red below 50%, orange 50-70%, green 70%+. Below the gauge: per-member bars showing individual coverage with member names.

**Tag:** small pill for dietary tags (vegetarian, gluten-free, seasonal, etc.) in light gray.

**ChatBubble:** user messages right-aligned (white bg), assistant messages left-aligned (cream bg). Assistant messages support inline product cards (when AI recommends a product in conversation).

**Skeleton:** loading placeholder matching each component's layout — product card skeleton, basket skeleton. Gray shimmer animation.

**Verify:** Render all components with sample data on a test page. Visual check: colors match design tokens, badges are legible, gauge animates smoothly.
**Commit:** `feat(ui): build design system components`

---

## Step 3.2: Build Family Setup Page
Route: /family

If no family exists: show a creation form. Family name input + "Get Started" button. After family created, show member addition form.

Member addition: form with fields — name, age (number), relation (dropdown), diet type (radio: veg/non-veg/flexible), health conditions (multi-select or tag input — show common conditions as tappable chips: diabetes, cholesterol, anemia, thyroid, hypertension, celiac, peanut allergy, lactose intolerance, obesity + free text for others), allergies (tag input), height (optional), weight (optional).

Show current members as cards below the form: name, age, relation, conditions as badges, edit and delete buttons. Temporary member toggle: "This person is visiting" checkbox → shows start/end date fields.

Pre-seed button (for demo purposes): "Load Sample Family (Johnson)" — creates the Johnson test family with one click so the demo doesn't waste time on data entry.

**Verify:** Create a family. Add 4 members with conditions. Edit one. Delete one. Re-add. Family persists in the database. Pre-seed button creates the Johnson family instantly.
**Commit:** `feat(family): build family setup page with member management`

---

## Step 3.3: Build Shop Page with Dynamic Health Badges
Route: /shop

This is the most important page. This is where the magic happens.

**Product grid:** responsive — 2 columns mobile, 3 columns tablet, 4 columns desktop. Each product is a ProductCard with health badge. Products are SORTED by health score — highest-scoring products appear first. If no family is set up, products show in default order with no badges.

**Category filter:** horizontal scrollable category chips at the top (All, Vegetables, Fruits, Proteins, Grains, Dairy, Pantry, Snacks). Tapping a category filters the grid.

**Search:** search bar at top, filters by nameEn as the user types.

**The critical behavior:** when the customer sends a message via the chat panel (Step 3.5) and the context changes (new visitor, health state, mood), THIS PAGE RE-RENDERS. Products re-sort. Badges change. The customer literally watches the store transform while chatting. This is implemented by: the chat panel calls the /api/chat endpoint → response includes updatedScores → the shop page state updates with new scores → React re-renders the grid with new sort order and badges.

**Loading state:** skeleton product cards matching the grid layout.
**Empty state:** "No products found" with suggestion to adjust filters.

**Verify:** Open /shop with Johnson family set up. Kale should be near the top of vegetables with a green "Recommended" badge for Mike's cholesterol. Peanut butter should have a red "Avoid" badge for Jake. Quinoa should have green badge for Linda (gluten-free). Search "quinoa" — finds quinoa with green badge. Filter to Fruits — sorted by health relevance.
**Commit:** `feat(shop): build product grid with dynamic health badges and category filters`

---

## Step 3.4: Build Product Detail Page
Route: /product/[id]

Product image (large). Product name in English. Price with variant selector (tappable chips: 1 lb $3.99, 2 lb $6.99). Selected variant highlighted.

**Health badge** — larger version with full reasoning text visible (not just tooltip). If the product is "recommended": green section with all reasons listed, each mentioning the family member name. If "limit" or "avoid": orange/red section with explanation of why and for whom.

**Nutrition information:** expandable section showing the USDA FoodData Central nutritional data per 100g — energy, protein, carbs, fat, fiber, and key micronutrients (iron, calcium, vitamin C, folate — whatever is significant for this product). Show the data from the NutritionLookup table, formatted cleanly. Highlight nutrients that are relevant to the family's health conditions (e.g., fiber highlighted if someone has high cholesterol).

**Dietary tags:** row of Tag pills (vegetarian, iron-rich, gluten-free, high-fiber, etc.)

**"Add to Basket" button:** primary button with selected variant. Adds to the family's basket.

**Verify:** Open kale detail. Shows USDA nutrition with fiber highlighted (Mike has high cholesterol), green badge with reasoning mentioning Mike. Select 1 lb variant. Add to basket.
**Commit:** `feat(product): build product detail page with nutrition data and health reasoning`

---

## Step 3.5: Build Chat Panel
This is the second most important feature after the shop page.

**Floating button:** bottom-right corner on every page. Forest Green circle with a chat icon. Badge showing "New" or unread indicator if there's a suggested prompt.

**Panel behavior:** on mobile — full-screen bottom sheet sliding up with handle. On desktop — right sidebar, 400px wide, sliding in. Both have: header ("Grocery Assistant" + close button), message area (scrollable), input bar at bottom.

**Suggested prompts:** shown when chat is empty or on first open. 3-4 tappable prompt suggestions relevant to American grocery shopping context. Examples should feel natural, not like menu options. Tapping a suggestion sends it as a message. Examples: "My mom's visiting and can't eat gluten," "Jake has a cold — need something light," "Saturday BBQ — what should I grab?"

**Message flow:**
1. Customer types a message and hits send
2. Show the message in user bubble (right-aligned)
3. Show a typing indicator in assistant area
4. Call POST /api/chat with the message
5. On response: show assistant message (left-aligned, cream bg)
6. If the response includes updatedScores: emit an event or update shared state so the shop page (if open behind the panel) re-renders with new product sorting and badges
7. If the response mentions specific products: render inline product cards within the chat message with "Add to Basket" buttons
8. If a basket was generated: show a mini basket summary card in chat with "View Full Basket" link

**The store-transforms-while-chatting experience:** on desktop, the chat panel is a sidebar — the shop page is visible alongside it. When the customer sends "Jake has a cold," the products on the shop page visibly re-sort and badges change WHILE the chat response is appearing. This is the "wow" moment.

On mobile, the shop page updates after the user closes the chat panel — they see the transformed store.

**Input bar:** text field with placeholder "Tell me about your family's week..." and send button. Support for Enter to send on desktop.

**Error handling:** if the AI call fails, show "Something went wrong. Tap to retry." Don't break the chat — preserve the conversation history.

**Verify:** Open chat. Send "My mom Linda is visiting from Florida, she can't have gluten." Response acknowledges naturally. On desktop: shop page behind the panel re-sorts products — gluten-free items rise. Send "Jake has a summer cold" — store transforms again, hydrating items rise. Send "Actually Jake is feeling better" — store shifts back. Send "Saturday we're doing a BBQ" — BBQ-friendly items boost.
**Commit:** `feat(chat): build chat panel with natural conversation and live store transformation`

---

## Step 3.6: Build Basket Page
Route: /basket

If no basket exists yet: show an empty state with "Chat with our assistant about your family's week and we'll build your perfect basket" prompt + link to open chat.

If basket exists (generated from chat or explicitly requested):

**Basket header:** "Your Weekly Groceries" + weekly context summary ("BBQ Saturday, Jake has cold, Linda visiting gluten-free").

**Coverage gauge:** prominent at the top. Overall percentage. Color-coded. Below: per-member coverage bars — "Mike (cholesterol, pre-diabetic): 82%" "Jake (peanut allergy, cold): 91%" "Linda (celiac): 78%" "Sarah: 94%". Use actual member names and their conditions.

**Items list:** grouped by category (Vegetables, Fruits, Proteins, etc.). Each item is a BasketItem: product image, name (English), recommended quantity with variant shown, price in USD, reasoning text explaining why this specific quantity of this specific product for this specific family this specific week. Quantity adjustable: +/- buttons or tap to change variant. Remove button (X).

**Real-time coverage update:** when a customer changes a quantity or removes an item, the coverage score and per-member bars UPDATE IMMEDIATELY without a full page reload. Call PUT /api/basket/adjust → recalculated coverage returns → UI updates. The customer sees: remove kale → Mike's fiber coverage drops from 82% to 68%. This is powerful feedback that encourages keeping health-critical items.

**Total price:** prominently shown in $X,XXX.XX format. Updates on any change.

**Budget input:** optional field "Set a budget: $___". On submit: basket re-optimizes under the budget constraint. Items may be removed or quantities reduced. Coverage score updates to show the tradeoff. Clear messaging: "Under $75: 72% coverage. Reduced: trail mix (removed), sweet potato (2 lb → 1 lb). Your family's fiber coverage will be lower this week."

**"Looks Good" button:** not a checkout — this is the AI engine demo, not a full e-commerce flow. The button confirms the basket and shows a summary: "Your basket covers 87% of your family's weekly nutritional needs across 12 items for $84.50. You're all set for the week!"

**Verify:** View basket generated from chat flow. Coverage gauge shows with member names. Change kale from 1 lb to 2 lb — coverage recalculates live. Remove an item — coverage drops, affected member's bar changes. Set budget $75 — basket re-optimizes, shows tradeoffs.
**Commit:** `feat(basket): build basket page with coverage gauge, quantity adjustment, and budget optimization`

---

## Step 3.7: Build Landing/Home Page
Route: / (root)

This is what judges see first. It needs to immediately communicate what this product is and make them want to try it.

**Hero section:** cream background. Large heading: "Your Family's Wellness Starts Here" in Georgia Bold, Forest Green. Subheading: "A grocery store that knows your family's health — and adapts every week." Two CTA buttons: "Set Up Your Family" (primary, links to /family) and "Try the Demo" (secondary, loads Johnson family and goes to /shop).

**How It Works section:** 3 visual steps:
1. "Tell us about your family" — icon + brief description
2. "Chat about your week" — icon + example natural language message ("My mom's visiting from Florida, she can't have gluten...")
3. "Shop a store designed for you" — icon + example of products with health badges

**The "Try It" hook:** a live demo embed or prominent button that immediately loads the Johnson test family and opens the shop page with chat. Reduce friction to zero — judges should be shopping within 10 seconds.

**Footer:** "Built with Next.js, Aurora PostgreSQL, and Gemini Flash. Powered by USDA FoodData Central nutritional data."

**Verify:** Landing page loads fast (< 2 seconds). "Try the Demo" creates the Johnson family and navigates to /shop with the chat ready. Everything feels polished — no broken layouts, no placeholder text.
**Commit:** `feat(landing): build landing page with demo quick-start`

---

## Step 3.8: Connect All Pages
Wire up navigation and state management across all pages.

**Navigation:** header with logo (left), nav links (Shop, Basket, Family), active state on current page. Chat button floats on every page.

**State management:** family context is global — when the chat updates the family context, the shop page and basket page both reflect the changes. Use React Context or a lightweight state management approach. The familyId is stored in the app state (or URL parameter) and passed to all API calls.

**Page transitions:** smooth, no jarring reloads. Use Next.js client-side navigation.

**Responsive:** verify every page at 375px and 1024px. Chat panel: bottom sheet on mobile, sidebar on desktop. Product grid: 2 cols mobile, 4 cols desktop.

**Verify:** Navigate: landing → family setup → shop → product detail → basket. Chat opens on any page. Context changes from chat reflect on shop page without navigation. Mobile and desktop layouts correct.
**Commit:** `feat(nav): connect all pages with shared state and navigation`

---

## Step 3.9: Test the Full Flow
Run through the complete demo flow that judges will see:

1. Open the app → landing page loads
2. Click "Try the Demo" → Johnson family created, shop page opens
3. Browse — products sorted by health relevance. Kale has green "Good for Mike" badge (fiber for cholesterol). Peanut butter has red "Avoid — Jake's peanut allergy" badge. Quinoa has green badge for Linda (gluten-free).
4. Open kale — see USDA nutrition, fiber highlighted, full reasoning with family member names
5. Open chat → type "My mom Linda is visiting from Florida, she can't have gluten. Jake has a summer cold. It's going to be super hot, want light fresh meals. Saturday we're doing a BBQ."
6. AI responds naturally, acknowledging everything
7. WATCH THE SHOP PAGE TRANSFORM (desktop: visible behind chat. Mobile: switch to shop after closing chat): products re-sorted. Hydrating foods (watermelon, oranges) rose to top. Gluten-free items boosted for Linda. Light foods featured. Heavy items dropped. New badges: "Good for Jake's recovery" on oranges.
8. Ask in chat: "Can Jake have trail mix with his cold?"
9. AI responds with contextual advice about trail mix (peanut allergy + cold), suggests alternatives
10. Open basket page — AI-generated basket with items, quantities, coverage score: "87% coverage for 4 family members, $84.50"
11. Each member's coverage visible: "Mike: 82%, Jake: 91%, Linda: 78%, Sarah: 94%"
12. Change kale from 1 lb to 2 lb — coverage updates live: "Mike: 82% → 88%"
13. Set budget $75 — basket re-optimizes, shows tradeoffs
14. Chat: "Actually Jake is feeling better" → cold state removed, store shifts back, basket updates
15. Chat: "Linda left yesterday" → temporary member removed, store adjusts for 3 people

**Verify:** All 15 steps work on both mobile and desktop without errors. The store transformation is visually clear and impressive.
**Commit:** `test(e2e): verify complete demo flow — 15 steps`

---

## Step 3.10: Deploy to Vercel
Deploy the Next.js app to Vercel.

1. Push all code to GitHub
2. In Vercel dashboard: import the repo (or the subfolder if monorepo)
3. Set environment variables: DATABASE_URL (Aurora connection string), GEMINI_API_KEY
4. Deploy — Vercel builds and deploys automatically
5. Verify: open the Vercel URL, run through the demo flow on the deployed version
6. Check: API routes work against Aurora (not just localhost), response times acceptable (< 2 seconds for scoring, < 3 seconds for chat)

If response times are slow: add appropriate caching headers, optimize Prisma queries (add includes and selects to avoid loading unnecessary data), consider adding a simple in-memory cache for USDA data and rules (they don't change).

**Verify:** Deployed app works end-to-end on the public Vercel URL. Share the URL with someone else — they can set up a family and shop.
**Commit:** `chore(deploy): deploy to Vercel with Aurora PostgreSQL`

---

## Step 3.11: Create Architecture Diagram
Create a clean architecture diagram showing:

Left side: User → Next.js on Vercel (frontend + API routes)
Center: API routes call → Scoring Engine (TypeScript, deterministic) and → Basket Optimizer (TypeScript)
Right side: Two external services: Aurora PostgreSQL (stores USDA data, health rules, products, family profiles) and Gemini Flash (natural language understanding + conversation)

Show the data flow clearly:
1. Customer types natural text → goes to Gemini for context extraction
2. Extracted context → stored in Aurora
3. Scoring engine reads family data + product data + health rules from Aurora
4. Scores flow back to the frontend → products re-sort, badges update
5. Basket optimizer uses scores + quantity logic → produces designed basket

Key labels: "USDA FoodData Central," "15+ health conditions from USDA/AHA," "100+ American grocery products," "Real-time scoring," "Natural language in English/Spanish"

Create as an image (use a tool, draw by hand and photograph, or create in Figma/Excalidraw). Save as public/architecture.png and include in the submission.

**Verify:** Diagram is clear, readable, and accurately represents the system.
**Commit:** `docs: create architecture diagram`

---

## Step 3.12: Record 3-Minute Demo Video
Record the demo video showing the complete flow. Under 3 minutes. Upload to YouTube (unlisted).

Script:
- 0:00-0:20 — "This is HealthCart, a grocery store where every product knows your family's health. Not a health app, not a recipe recommender — a real grocery store enhanced by AI."
- 0:20-0:40 — Show family setup: "The Johnson family — Dad Mike with high cholesterol and pre-diabetes, Mom Sarah managing weight, 14-year-old Jake with a peanut allergy, and Grandma Linda visiting with celiac disease." (use the demo quick-start button)
- 0:40-1:20 — Show the store: "Every product is scored against the family's health. Kale is recommended for Mike's cholesterol. Quinoa is gluten-free for Linda. Peanut butter is flagged for Jake's allergy. But watch what happens when I tell the store about this week..."
- 1:20-2:00 — Type the natural language message about Linda visiting from Florida + Jake's cold + hot weather + Saturday BBQ. "Watch the store transform. Hydrating foods rose to the top for Jake's cold. Gluten-free items are featured for Linda. Light, fresh foods for the heat. The store is different THIS WEEK because the family's situation is different."
- 2:00-2:30 — Show the basket: "An AI-designed grocery basket covering 87% of this family's weekly nutritional needs. Each item has a reason, each quantity is calculated from USDA guidelines. Change the budget — it re-optimizes. Remove an item — coverage updates in real time."
- 2:30-2:50 — "Built with Next.js on Vercel, Aurora PostgreSQL for USDA FoodData Central nutritional data, and Gemini Flash for understanding natural conversation in English and Spanish."
- 2:50-3:00 — "Every family deserves a grocery store that knows their health. This is it."

**Verify:** Video is under 3 minutes. Shows the working application. Explains the problem, the solution, and the tech. Clear audio. Uploaded to YouTube.
**Commit:** `docs: record and upload demo video`

---

## Step 3.13: Submit to Devpost
Submit the hackathon entry on Devpost with:

1. Text description — which AWS database used (Aurora PostgreSQL), what problem it solves (American families with complex health needs — allergies, chronic conditions, visiting relatives — can't find a grocery platform that personalizes for everyone in the household), why this problem (diet-related disease burden, food allergies affecting 1 in 13 children in the US)
2. Demo video link (YouTube)
3. Vercel project URL + Vercel Team ID
4. Architecture diagram image
5. Screenshot of Aurora PostgreSQL in AWS Console showing the database and tables

**Verify:** Submission is complete. All required fields filled. Video plays. Links work.
**Commit:** `docs: submit to hackathon`

---

## Phase 3 Complete Checklist

Before submitting, ALL of these must be true:

- [ ] Design system components built (Button, ProductCard, HealthBadge, BasketItem, CoverageGauge, ChatBubble, Tag, Skeleton)
- [ ] Family Setup page working with member CRUD and Johnson demo quick-start
- [ ] Shop page with product grid sorted by health score
- [ ] Health badges rendering correctly (green/orange/red with reasoning)
- [ ] Products re-sort when context changes from chat (the store transforms)
- [ ] Product Detail page with USDA nutrition, health reasoning, dietary tags
- [ ] Chat panel floating on every page
- [ ] Chat handles natural language in English and Spanish
- [ ] Chat responses are conversational and use family member names
- [ ] Store visually transforms while chatting (desktop: visible behind panel)
- [ ] Basket page with coverage gauge and per-member breakdown
- [ ] Basket quantities adjustable with real-time coverage update
- [ ] Budget constraint re-optimizes basket with tradeoff explanation (USD)
- [ ] Landing page with Johnson demo quick-start working
- [ ] Navigation connects all pages with shared state
- [ ] Mobile responsive (375px) and desktop (1024px+)
- [ ] Deployed on Vercel with Aurora PostgreSQL
- [ ] Full 15-step demo flow working on deployed URL
- [ ] Architecture diagram created
- [ ] Demo video recorded (< 3 minutes) with American family/food context
- [ ] Submitted on Devpost with all required materials
- [ ] All steps committed individually
- [ ] PROGRESS.md fully updated
