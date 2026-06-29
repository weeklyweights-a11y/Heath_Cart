/**
 * Runnable golden scenarios for Intelligence v2 parity.
 * Run: npm run test:golden
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import "../../__tests__/setup";
import { prisma } from "@/lib/db";
import { ruleBasedExtract } from "@/lib/ai";
import { applyExtractedContext } from "@/lib/context-applier";
import { buildActiveFamilyContext } from "@/lib/family-context";
import { seedJohnson } from "@/lib/seed-johnson";
import { scoreProductsForFamily } from "@/lib/scoring";
import { generateBasket } from "@/lib/optimizer";
import { pickChatProductHighlights } from "@/lib/member-labels";
import { buildProductVector, buildIdealVector } from "../ranking/nutrient-vector";
import { cosineSimilarity } from "../ranking/cosine-rank";
import { isIntelligenceV2Enabled } from "../config";
import { getWeekStart, toDateOnly } from "@/lib/week";
import type { ApplyContextResult } from "@/lib/context-applier";
import type { FamilyMemberDto } from "@/lib/types";

async function persistWeeklyContext(
  familyId: string,
  applied: ApplyContextResult,
): Promise<void> {
  const weekStart = toDateOnly(getWeekStart());
  const contextJson = applied.mergedContext as unknown as Prisma.InputJsonValue;
  await prisma.weeklyContext.upsert({
    where: { familyId_weekStart: { familyId, weekStart } },
    create: {
      familyId,
      weekStart,
      rawMessage: applied.rawMessage,
      extractedContext: contextJson,
      cuisineMood: applied.cuisineMood,
    },
    update: {
      rawMessage: applied.rawMessage,
      extractedContext: contextJson,
      cuisineMood: applied.cuisineMood,
    },
  });
}

async function applyAndPersist(
  familyId: string,
  message: string,
  members: FamilyMemberDto[],
): Promise<void> {
  const weekStart = toDateOnly(getWeekStart());
  const existingWeekly = await prisma.weeklyContext.findUnique({
    where: { familyId_weekStart: { familyId, weekStart } },
  });
  const applied = await applyExtractedContext(
    familyId,
    ruleBasedExtract(message, members),
    existingWeekly,
    message,
  );
  await persistWeeklyContext(familyId, applied);
}

async function memberDtos(familyId: string): Promise<FamilyMemberDto[]> {
  const members = await prisma.familyMember.findMany({ where: { familyId } });
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    age: m.age,
    relation: m.relation,
    dietType: m.dietType,
    conditions: m.conditions,
    allergies: m.allergies,
  }));
}

async function glutenProductIds(): Promise<Set<string>> {
  const rows = await prisma.dietaryTag.findMany({
    where: { tag: "contains_gluten" },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId));
}

async function nonVegetarianProductIds(): Promise<Set<string>> {
  const rows = await prisma.dietaryTag.findMany({
    where: { tag: "non_vegetarian" },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId));
}

describe.sequential("golden scenarios (v2)", () => {
  let familyId: string;

  beforeAll(async () => {
    process.env.VITEST_V2_SUITE = "1";
    process.env.INTELLIGENCE_V2 = "true";
    expect(isIntelligenceV2Enabled()).toBe(true);
    const family = await seedJohnson(false);
    familyId = family.id;
    const kgCount = await prisma.kgNode.count();
    if (kgCount === 0) throw new Error("Run npm run seed:kg first");
  });

  afterAll(() => {
    process.env.INTELLIGENCE_V2 = "false";
    delete process.env.VITEST_V2_SUITE;
  });

  it("johnson-core: no peanut SKUs in basket", async () => {
    const basket = await generateBasket(familyId);
    const peanutTags = await prisma.dietaryTag.findMany({
      where: { tag: { in: ["contains_peanuts", "peanut"] } },
      select: { productId: true },
    });
    const ids = new Set(peanutTags.map((t) => t.productId));
    for (const item of basket.items) {
      expect(ids.has(item.productId)).toBe(false);
    }
  });

  it("johnson-core: low_glycemic products get graph boost for Mike (diabetes)", async () => {
    const scores = await scoreProductsForFamily(familyId, { force: true });
    const lowGi = await prisma.product.findFirst({
      where: { isActive: true, tags: { some: { tag: "low_glycemic" } } },
      select: { id: true },
    });
    expect(lowGi).toBeTruthy();
    const s = scores.find((x) => x.productId === lowGi!.id);
    expect(s?.scoreBreakdown?.graph).toBeGreaterThan(0);
  });

  it("johnson-linda-celiac: gluten products scored avoid or excluded", async () => {
    const members = await memberDtos(familyId);
    const extracted = ruleBasedExtract(
      "My mom Linda is visiting and she can't eat gluten.",
      members,
    );
    await applyExtractedContext(
      familyId,
      extracted,
      null,
      "My mom Linda is visiting and she can't eat gluten.",
    );
    const scores = await scoreProductsForFamily(familyId, { force: true });
    const glutenProducts = await prisma.product.findMany({
      where: { isActive: true, tags: { some: { tag: "contains_gluten" } } },
      select: { id: true },
    });
    for (const gp of glutenProducts) {
      const s = scores.find((x) => x.productId === gp.id);
      if (s) expect(["avoid", "limit"].includes(s.badge) || s.score === 0).toBe(true);
    }
  });

  it("johnson-linda-celiac: zero contains_gluten in basket", async () => {
    const basket = await generateBasket(familyId);
    const glutenIds = await glutenProductIds();
    for (const item of basket.items) {
      expect(glutenIds.has(item.productId)).toBe(false);
    }
  });

  it("jake-cold: hydrating products rank in top half", async () => {
    const members = await memberDtos(familyId);
    await applyExtractedContext(
      familyId,
      ruleBasedExtract("Jake has a cold", members),
      null,
      "Jake has a cold",
    );
    const scores = await scoreProductsForFamily(familyId, { force: true });
    const hydrating = await prisma.product.findMany({
      where: { isActive: true, tags: { some: { tag: { in: ["hydrating", "vitamin_c_rich"] } } } },
      select: { id: true },
    });
    const hydrateIds = new Set(hydrating.map((p) => p.id));
    const ranked = scores.filter((s) => hydrateIds.has(s.productId));
    const median = scores[Math.floor(scores.length / 2)]?.score ?? 0;
    expect(ranked.filter((s) => s.score >= median).length).toBeGreaterThan(0);
  });

  it("jake-cold-lifecycle: remove:true reverts Jake cold from context", async () => {
    const members = await memberDtos(familyId);
    await applyAndPersist(familyId, "Jake has a cold", members);
    let ctx = await buildActiveFamilyContext(familyId);
    expect(ctx.activeMembers.find((m) => m.name === "Jake")?.effectiveConditions).toContain("cold");

    await applyAndPersist(familyId, "Jake is feeling better", members);
    ctx = await buildActiveFamilyContext(familyId);
    expect(ctx.activeMembers.find((m) => m.name === "Jake")?.effectiveConditions).not.toContain("cold");
  });

  it("vegetarian-member: basket excludes non_vegetarian tagged products", async () => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 7);
    await prisma.familyMember.create({
      data: {
        familyId,
        name: "VegetarianGuest",
        age: 35,
        relation: "other",
        dietType: "vegetarian",
        conditions: [],
        allergies: [],
        isTemporary: true,
        startDate: start,
        endDate: end,
      },
    });
    try {
      const basket = await generateBasket(familyId);
      const nvIds = await nonVegetarianProductIds();
      for (const item of basket.items) {
        expect(nvIds.has(item.productId)).toBe(false);
      }
    } finally {
      await prisma.familyMember.deleteMany({
        where: { familyId, name: "VegetarianGuest" },
      });
    }
  });

  it("budget-400: basket respects budget cap", async () => {
    const basket = await generateBasket(familyId, { budget: 400 });
    expect(basket.totalPrice).toBeLessThanOrEqual(400);
  });

  it("budget-400: tight budget sets coverageTradeoff", async () => {
    const basket = await generateBasket(familyId, { budget: 80 });
    expect(basket.totalPrice).toBeLessThanOrEqual(80);
    expect(basket.coverageTradeoff?.length).toBeGreaterThan(0);
  });

  it("spanish-intent: somos dos extracts members away", () => {
    const members = [
      { id: "1", name: "Sarah", age: 48, relation: "spouse" as const, dietType: "flexible" as const, conditions: [], allergies: [] },
      { id: "2", name: "Jake", age: 10, relation: "child" as const, dietType: "non_vegetarian" as const, conditions: [], allergies: ["peanut"] },
    ];
    const ctx = ruleBasedExtract("somos dos esta semana", members);
    expect(ctx.household_changes.some((c) => c.action === "members_away")).toBe(true);
  });

  it("normalization-landmine: lentils beat high-sodium junk (unit)", () => {
    const weeklyRda = { ironMg: 56, fiberG: 28, vitaminCMg: 630, proteinG: 392, calciumMg: 7000 };
    const limits = { sodium: 600, sugar: 15, saturatedFat: 5, glycemicIndex: 55 };
    const axisWeights = new Map([["fiber", 2], ["glycemicIndex", 2], ["sodium", 2]] as const);
    const ideal = buildIdealVector(weeklyRda, axisWeights as never, limits);
    const lentils = buildProductVector(
      { fiberG: 8, proteinG: 9, ironMg: 3, vitaminCMg: 1, calciumMg: 20, sodiumMg: 5, sugarG: 1, saturatedFatG: 0.1, glycemicIndex: 30 } as never,
      100,
      weeklyRda,
      limits,
    );
    const junk = buildProductVector(
      { fiberG: 1, proteinG: 2, ironMg: 0.5, vitaminCMg: 0, calciumMg: 10, sodiumMg: 800, sugarG: 20, saturatedFatG: 8, glycemicIndex: 75 } as never,
      100,
      weeklyRda,
      limits,
    );
    expect(cosineSimilarity(lentils, ideal)).toBeGreaterThan(cosineSimilarity(junk, ideal));
  });

  it("offline-demo: ruleBasedExtract without API key", () => {
    const prev = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    const ctx = ruleBasedExtract("Jake has a cold — need something light", [
      { id: "1", name: "Jake", age: 10, relation: "child", dietType: "non_vegetarian", conditions: [], allergies: ["peanut"] },
    ]);
    expect(ctx.health_states.some((h) => h.member === "Jake" && h.condition === "cold")).toBe(true);
    if (prev) process.env.GEMINI_API_KEY = prev;
  });

  it("chat-highlights: basket qty on highlights", async () => {
    const basket = await generateBasket(familyId);
    const scores = await scoreProductsForFamily(familyId);
    const catalog = basket.items.map((i) => ({
      id: i.productId,
      nameEn: i.name,
      category: i.category ?? "Other",
      price: i.price,
    }));
    const { toAdd } = pickChatProductHighlights({
      response: basket.items.map((i) => i.name).join(" "),
      catalog,
      scores,
      basket,
    });
    expect(toAdd.some((h) => h.basketQty != null && h.basketQty > 0)).toBe(true);
  });
});
