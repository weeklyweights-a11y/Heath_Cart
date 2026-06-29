import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../../__tests__/setup";
import { prisma } from "@/lib/db";
import { seedJohnson } from "@/lib/seed-johnson";
import { scoreProductsForFamily } from "@/lib/scoring";
import {
  addItemToBasket,
  adjustBasket,
  generateBasket,
  getBasketById,
} from "@/lib/optimizer";
import { isIntelligenceV2Enabled } from "@/lib/intelligence/config";

describe("v2 smoke (requires INTELLIGENCE_V2)", () => {
  let familyId: string;

  beforeAll(async () => {
    process.env.VITEST_V2_SUITE = "1";
    process.env.INTELLIGENCE_V2 = "true";
    expect(isIntelligenceV2Enabled()).toBe(true);
    const family = await seedJohnson(false);
    familyId = family.id;
    await prisma.kgNode.count().then((n) => {
      if (n === 0) {
        throw new Error("Run npm run seed:kg before v2 smoke tests");
      }
    });
  });

  it("scores products with scoreBreakdown", async () => {
    const scores = await scoreProductsForFamily(familyId, { force: true });
    expect(scores.length).toBeGreaterThan(50);
    const top = scores.find((s) => s.score > 0 && s.scoreBreakdown);
    expect(top?.scoreBreakdown?.nutrient).toBeDefined();
  });

  it("generates basket with explanations and no peanut violations for Jake", async () => {
    const basket = await generateBasket(familyId);
    expect(basket.items.length).toBeGreaterThan(5);
    expect(basket.coverageScore).toBeGreaterThan(0);

    const withExplain = basket.items.filter((i) => i.explanation);
    expect(withExplain.length).toBeGreaterThan(0);

    const peanutTagged = await prisma.dietaryTag.findMany({
      where: { tag: { in: ["contains_peanuts", "peanut"] } },
      select: { productId: true },
    });
    const peanutIds = new Set(peanutTagged.map((t) => t.productId));
    for (const item of basket.items) {
      expect(peanutIds.has(item.productId)).toBe(false);
    }
  });

  it("adjustBasket and getBasketById refresh v2 traces", async () => {
    const basket = await generateBasket(familyId);
    const first = basket.items[0];
    const adjusted = await adjustBasket(familyId, basket.basketId, [
      { productId: first.productId, newQuantity: first.quantity + 1 },
    ]);
    expect(adjusted.coverageScore).toBeGreaterThan(0);

    const reloaded = await getBasketById(basket.basketId);
    expect(reloaded.items[0]?.explanation).toBeDefined();
  });

  it("blocks unsafe add for peanut product when Jake has allergy", async () => {
    const peanut = await prisma.product.findFirst({
      where: {
        isActive: true,
        tags: { some: { tag: { in: ["contains_peanuts", "peanut"] } } },
      },
      include: { variants: true },
    });
    if (!peanut?.variants[0]) return;

    await expect(
      addItemToBasket(
        familyId,
        peanut.id,
        peanut.variants[0].id,
        1,
        (await generateBasket(familyId)).basketId,
      ),
    ).rejects.toThrow(/Cannot add/i);
  });

  afterAll(() => {
    process.env.INTELLIGENCE_V2 = "false";
    delete process.env.VITEST_V2_SUITE;
  });
});
