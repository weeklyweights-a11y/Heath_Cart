import { beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { prisma } from "../db";
import { generateBasket } from "../optimizer";
import { getWeekStart, toDateOnly } from "../week";
import { emptyExtractedContext } from "../types";

async function seedFamily(): Promise<string> {
  const family = await prisma.family.upsert({
    where: { id: "test-optimizer-family" },
    create: { id: "test-optimizer-family", name: "Johnson Optimizer" },
    update: {},
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

async function setContext(
  familyId: string,
  partial: ReturnType<typeof emptyExtractedContext>,
) {
  const weekStart = toDateOnly(getWeekStart());
  await prisma.weeklyContext.upsert({
    where: { familyId_weekStart: { familyId, weekStart } },
    create: {
      familyId,
      weekStart,
      rawMessage: "test",
      extractedContext: partial,
      cuisineMood: partial.mood?.overall ?? null,
    },
    update: {
      extractedContext: partial,
      cuisineMood: partial.mood?.overall ?? null,
    },
  });
}

describe("optimizer scenarios", () => {
  let familyId: string;

  beforeAll(async () => {
    familyId = await seedFamily();
  });

  it("1) full basket no budget", async () => {
    await prisma.weeklyContext.deleteMany({ where: { familyId } });
    const basket = await generateBasket(familyId);
    expect(basket.items.length).toBeGreaterThan(0);
    expect(basket.coverageScore).toBeGreaterThan(0);
    expect(basket.totalPrice).toBeGreaterThan(0);
    expect(Object.keys(basket.perMemberCoverage).length).toBeGreaterThan(0);
  });

  it("2) budget $75", async () => {
    const basket = await generateBasket(familyId, { budget: 75 });
    expect(basket.totalPrice).toBeLessThanOrEqual(75.01);
  });

  it("3) budget $50", async () => {
    const basket = await generateBasket(familyId, { budget: 50 });
    expect(basket.totalPrice).toBeLessThanOrEqual(50.01);
  });

  it("4) two people away", async () => {
    await setContext(familyId, {
      ...emptyExtractedContext(),
      membersAway: ["Sarah", "Jake"],
      household_changes: [
        { action: "members_away", name: "Sarah" },
        { action: "members_away", name: "Jake" },
      ],
    });
    const basket = await generateBasket(familyId);
    expect(basket.items.length).toBeGreaterThan(0);
  });

  it("5) cold context for Jake", async () => {
    await setContext(familyId, {
      ...emptyExtractedContext(),
      health_states: [{ member: "Jake", condition: "cold", since: "today" }],
    });
    const basket = await generateBasket(familyId);
    expect(basket.items.length).toBeGreaterThan(0);
  });

  it("6) BBQ requirement", async () => {
    await setContext(familyId, {
      ...emptyExtractedContext(),
      dietary_needs: [{ date: "Saturday", requirement: "bbq" }],
      mood: { overall: "bbq" },
    });
    const basket = await generateBasket(familyId);
    expect(basket.items.length).toBeGreaterThan(0);
  });
});
