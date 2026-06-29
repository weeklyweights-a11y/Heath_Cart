import { beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { prisma } from "../db";
import { scoreProductsForFamily } from "../scoring";
import { getWeekStart, toDateOnly } from "../week";
import type { ExtractedContext } from "../types";
import { emptyExtractedContext } from "../types";

async function seedJohnsonCore(): Promise<string> {
  const family = await prisma.family.upsert({
    where: { id: "test-johnson-core" },
    create: { id: "test-johnson-core", name: "Johnson Test Core" },
    update: { name: "Johnson Test Core" },
  });
  await prisma.familyMember.deleteMany({ where: { familyId: family.id } });
  await prisma.familyMember.createMany({
    data: [
      {
        familyId: family.id,
        name: "Mike",
        age: 52,
        relation: "self",
        dietType: "non_vegetarian",
        conditions: ["cholesterol", "diabetes"],
        allergies: [],
      },
      {
        familyId: family.id,
        name: "Sarah",
        age: 48,
        relation: "spouse",
        dietType: "flexible",
        conditions: [],
        allergies: [],
      },
      {
        familyId: family.id,
        name: "Jake",
        age: 14,
        relation: "child",
        dietType: "non_vegetarian",
        conditions: [],
        allergies: ["peanut"],
      },
    ],
  });
  return family.id;
}

async function seedJohnsonFull(): Promise<string> {
  const id = await seedJohnsonCore();
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);
  await prisma.familyMember.create({
    data: {
      familyId: id,
      name: "Linda",
      age: 70,
      relation: "parent",
      dietType: "flexible",
      conditions: ["celiac"],
      allergies: [],
      isTemporary: true,
      startDate: start,
      endDate: end,
    },
  });
  return id;
}

async function setWeeklyContext(
  familyId: string,
  extracted: ExtractedContext,
) {
  const weekStart = toDateOnly(getWeekStart());
  await prisma.weeklyContext.upsert({
    where: { familyId_weekStart: { familyId, weekStart } },
    create: {
      familyId,
      weekStart,
      rawMessage: "test",
      extractedContext: extracted,
      cuisineMood: extracted.mood?.overall ?? null,
    },
    update: {
      extractedContext: extracted,
      cuisineMood: extracted.mood?.overall ?? null,
    },
  });
}

async function clearWeeklyContext(familyId: string) {
  await prisma.weeklyContext.deleteMany({ where: { familyId } });
}

async function findProduct(namePart: string) {
  return prisma.product.findFirst({
    where: { nameEn: { contains: namePart, mode: "insensitive" } },
  });
}

describe("scoring scenarios", () => {
  let coreFamilyId: string;
  let fullFamilyId: string;

  beforeAll(async () => {
    coreFamilyId = await seedJohnsonCore();
    fullFamilyId = await seedJohnsonFull();
  });

  it("1) base scoring — kale high, peanut butter avoid for Jake", async () => {
    await clearWeeklyContext(coreFamilyId);
    const scores = await scoreProductsForFamily(coreFamilyId);
    const kale = await findProduct("Kale");
    const peanut = await findProduct("Peanut Butter");
    const kaleScore = scores.find((s) => s.productId === kale?.id);
    const peanutScore = scores.find((s) => s.productId === peanut?.id);
    expect(kaleScore && kaleScore.score).toBeGreaterThan(0);
    expect(peanutScore?.badge).toBe("avoid");
  });

  it("2) Linda celiac via context — gluten products avoid", async () => {
    await setWeeklyContext(coreFamilyId, {
      ...emptyExtractedContext(),
      household_changes: [
        { action: "add_temp", name: "Linda", conditions: ["celiac"] },
      ],
    });
    const scores = await scoreProductsForFamily(coreFamilyId);
    const sourdough = await findProduct("Sourdough");
    const breadScore = scores.find((s) => s.productId === sourdough?.id);
    expect(breadScore?.badge).toBe("avoid");
  });

  it("3) Jake cold — hydrating items rank higher", async () => {
    await clearWeeklyContext(coreFamilyId);
    const base = await scoreProductsForFamily(coreFamilyId);
    await setWeeklyContext(coreFamilyId, {
      ...emptyExtractedContext(),
      health_states: [{ member: "Jake", condition: "cold", since: "today" }],
    });
    const scores = await scoreProductsForFamily(coreFamilyId);
    const watermelon = await findProduct("Watermelon");
    const wm = scores.find((s) => s.productId === watermelon?.id);
    const baseWm = base.find((s) => s.productId === watermelon?.id);
    expect(wm && baseWm && wm.score).toBeGreaterThan(baseWm.score);
  });

  it("4) BBQ mood boosts grill-friendly items", async () => {
    await setWeeklyContext(coreFamilyId, {
      ...emptyExtractedContext(),
      mood: { overall: "bbq" },
      dietary_needs: [{ requirement: "bbq" }],
    });
    const scores = await scoreProductsForFamily(coreFamilyId);
    const chicken = await findProduct("Chicken Breast");
    const ch = scores.find((s) => s.productId === chicken?.id);
    expect(ch && ch.score).toBeGreaterThan(0);
  });

  it("5) Mike+Linda only — Sarah and Jake away", async () => {
    await setWeeklyContext(fullFamilyId, {
      ...emptyExtractedContext(),
      membersAway: ["Sarah", "Jake"],
      household_changes: [
        { action: "members_away", name: "Sarah" },
        { action: "members_away", name: "Jake" },
      ],
    });
    const scores = await scoreProductsForFamily(fullFamilyId);
    const peanut = await findProduct("Peanut Butter");
    const pb = scores.find((s) => s.productId === peanut?.id);
    const jakeReason = pb?.reasoning.some((r) => r.includes("Jake")) ?? false;
    expect(jakeReason).toBe(false);
  });

  it("6) cleared context returns chronic-only scoring", async () => {
    await clearWeeklyContext(coreFamilyId);
    const a = await scoreProductsForFamily(coreFamilyId);
    const b = await scoreProductsForFamily(coreFamilyId);
    expect(a.map((s) => s.productId)).toEqual(b.map((s) => s.productId));
  });
});
