import { describe, expect, it } from "vitest";
import "./setup";
import { ruleBasedExtract } from "../ai";
import type { FamilyMemberDto } from "../types";

const members: FamilyMemberDto[] = [
  {
    id: "1",
    name: "Mike",
    age: 52,
    relation: "self",
    dietType: "non_vegetarian",
    conditions: ["cholesterol", "diabetes"],
    allergies: [],
  },
  {
    id: "2",
    name: "Sarah",
    age: 48,
    relation: "spouse",
    dietType: "flexible",
    conditions: [],
    allergies: [],
  },
  {
    id: "3",
    name: "Jake",
    age: 14,
    relation: "child",
    dietType: "non_vegetarian",
    conditions: [],
    allergies: ["peanut"],
  },
];

describe("AI extraction (rule-based fallback)", () => {
  it("1) full English — Linda, Jake cold, BBQ, hot", async () => {
    const ctx = await ruleBasedExtract(
      "My mom Linda is visiting from Florida, she can't have gluten. Jake has a summer cold. It's going to be super hot, want light fresh meals. Saturday we're doing a BBQ.",
      members,
    );
    expect(ctx.household_changes.some((c) => c.name === "Linda")).toBe(true);
    expect(ctx.health_states.some((h) => h.member === "Jake")).toBe(true);
    expect(ctx.dietary_needs.some((d) => d.requirement.includes("bbq"))).toBe(
      true,
    );
  });

  it("2) Spanish two-person household", async () => {
    const ctx = await ruleBasedExtract(
      "Solo esta semana somos dos, Sarah llevó a los niños a casa de la abuela",
      members,
    );
    expect(ctx.membersAway.length).toBeGreaterThan(0);
  });

  it("3) correction — Jake feeling better", async () => {
    const ctx = await ruleBasedExtract(
      "Actually Jake is feeling better",
      members,
    );
    expect(ctx.health_states.some((h) => h.remove === true)).toBe(true);
  });

  it("4) removal — Linda left", async () => {
    const ctx = await ruleBasedExtract("Linda left yesterday", members);
    expect(ctx.household_changes.some((c) => c.action === "remove")).toBe(true);
  });

  it("5) vague illness + light meals", async () => {
    const ctx = await ruleBasedExtract(
      "Not feeling great this week, want something simple and light",
      members,
    );
    expect(ctx.mood?.overall).toBeDefined();
  });

  it("6) multiple updates — sister, olive oil, oats", async () => {
    const ctx = await ruleBasedExtract(
      "Linda's sister also came, she's lactose intolerant. And we ran out of olive oil and oats.",
      members,
    );
    expect(ctx.practical_needs.length).toBeGreaterThanOrEqual(2);
  });

  it("7) US cultural — meal prep, keto", async () => {
    const ctx = await ruleBasedExtract(
      "Meal prep Sunday — need high protein options for Jake's sports week. Mike wants to keep it keto-friendly.",
      members,
    );
    expect(ctx.dietary_needs.some((d) => d.requirement.includes("keto"))).toBe(
      true,
    );
  });
});
