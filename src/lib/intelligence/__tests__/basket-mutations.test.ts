import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../../__tests__/setup";
import { prisma } from "@/lib/db";
import { seedJohnson } from "@/lib/seed-johnson";
import { getScoredProductDetails } from "@/lib/scoring";
import {
  addItemToBasket,
  adjustBasket,
  generateBasket,
  getBasketById,
} from "@/lib/optimizer";
import { isIntelligenceV2Enabled } from "../config";

describe.sequential("basket mutations (v2)", () => {
  let familyId: string;

  beforeAll(async () => {
    process.env.VITEST_V2_SUITE = "1";
    process.env.INTELLIGENCE_V2 = "true";
    expect(isIntelligenceV2Enabled()).toBe(true);
    const family = await seedJohnson(false);
    familyId = family.id;
    if ((await prisma.kgNode.count()) === 0) {
      throw new Error("Run npm run seed:kg first");
    }
  });

  afterAll(() => {
    process.env.INTELLIGENCE_V2 = "false";
    delete process.env.VITEST_V2_SUITE;
  });

  it("getScoredProductDetails exposes scoreBreakdown and graphPath", async () => {
    const products = await getScoredProductDetails(familyId);
    expect(products.length).toBeGreaterThan(20);
    const scored = products.find((p) => p.scoreBreakdown?.nutrient != null);
    expect(scored).toBeDefined();
    if (scored?.scoreBreakdown?.graphPaths?.length) {
      expect(scored.graphPath?.length).toBeGreaterThan(0);
    }
  });

  it("generateBasket items carry explanation with constraintsChecked", async () => {
    const basket = await generateBasket(familyId);
    const explained = basket.items.filter((i) => i.explanation);
    expect(explained.length).toBeGreaterThan(0);
    expect(explained[0]?.explanation?.constraintsChecked.length).toBeGreaterThan(0);
  });

  it("adjustBasket preserves v2 explanations", async () => {
    const basket = await generateBasket(familyId);
    const item = basket.items[0];
    const adjusted = await adjustBasket(familyId, basket.basketId, [
      { productId: item.productId, newQuantity: item.quantity + 1 },
    ]);
    const match = adjusted.items.find((i) => i.productId === item.productId);
    expect(match?.explanation?.why).toBeDefined();
  });

  it("getBasketById reloads persisted explanations", async () => {
    const basket = await generateBasket(familyId);
    const reloaded = await getBasketById(basket.basketId);
    expect(reloaded.items.length).toBe(basket.items.length);
    expect(reloaded.items.some((i) => i.explanation?.why)).toBe(true);
  });

  it("addItemToBasket rejects unsafe peanut SKU for Jake", async () => {
    const peanut = await prisma.product.findFirst({
      where: {
        isActive: true,
        tags: { some: { tag: { in: ["contains_peanuts", "peanut"] } } },
      },
      include: { variants: true },
    });
    if (!peanut?.variants[0]) return;

    const basket = await generateBasket(familyId);
    await expect(
      addItemToBasket(
        familyId,
        peanut.id,
        peanut.variants[0].id,
        1,
        basket.basketId,
      ),
    ).rejects.toThrow(/Cannot add/i);
  });

  it("addItemToBasket succeeds for safe product with explanation", async () => {
    const basket = await generateBasket(familyId);
    const safe = await prisma.product.findFirst({
      where: {
        isActive: true,
        id: { notIn: basket.items.map((i) => i.productId) },
        tags: { none: { tag: { in: ["contains_peanuts", "peanut"] } } },
      },
      include: { variants: true },
    });
    if (!safe?.variants[0]) return;

    const updated = await addItemToBasket(
      familyId,
      safe.id,
      safe.variants[0].id,
      1,
      basket.basketId,
    );
    const added = updated.items.find((i) => i.productId === safe.id);
    expect(added?.explanation?.constraintsChecked).toContain("hard-filter: pass");
  });
});
