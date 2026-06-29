import { buildActiveFamilyContext } from "@/lib/family-context";
import { calculateNutrientGaps } from "@/lib/nutrient-gaps";
import { weeklyTargetsForMember } from "@/lib/rda";
import type { WeeklyTargets } from "@/lib/rda";
import { traverseGraphForConditions } from "../graph/traverse";
import type { HouseholdState, NutrientAxis } from "../types";

const CUISINE_TO_INTENT: Record<string, string> = {
  bbq: "bbq",
  light_fresh: "light_fresh",
  hot_weather: "hot_weather",
  keto: "keto",
  meal_prep: "meal_prep",
};

function mergeWeeklyTargets(members: { age: number; relation: import("@prisma/client").MemberRelation }[]): WeeklyTargets {
  const totals = { ironMg: 0, fiberG: 0, vitaminCMg: 0, proteinG: 0, calciumMg: 0 };
  for (const m of members) {
    const t = weeklyTargetsForMember(m.age, m.relation);
    totals.ironMg += t.ironMg;
    totals.fiberG += t.fiberG;
    totals.vitaminCMg += t.vitaminCMg;
    totals.proteinG += t.proteinG;
    totals.calciumMg += t.calciumMg;
  }
  return totals;
}

function normalizeIntentKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const norm = raw.toLowerCase().replace(/\s+/g, "_");
  for (const [k, v] of Object.entries(CUISINE_TO_INTENT)) {
    if (norm.includes(k)) return v;
  }
  return norm;
}

export async function buildHouseholdState(familyId: string): Promise<HouseholdState> {
  const ctx = await buildActiveFamilyContext(familyId);
  const members = ctx.activeMembers;

  const conditions = new Set<string>();
  const excludeAllergens: string[] = [];
  let requireVegetarian = false;

  for (const m of members) {
    for (const c of m.effectiveConditions) conditions.add(c);
    for (const a of m.allergies) {
      excludeAllergens.push(a.toLowerCase());
      if (a.toLowerCase().includes("peanut")) conditions.add("peanut_allergy");
    }
    if (m.dietType === "vegetarian") requireVegetarian = true;
  }

  const cuisineMood =
    ctx.weeklyContext?.cuisineMood ??
    ctx.extractedContext.mood?.overall ??
    null;

  const intents: string[] = [];
  const moodIntent = normalizeIntentKey(cuisineMood);
  if (moodIntent) intents.push(moodIntent);

  for (const need of ctx.extractedContext.dietary_needs) {
    const i = normalizeIntentKey(need.requirement);
    if (i) intents.push(i);
  }

  const weekStart = ctx.referenceDate.toISOString().slice(0, 10);
  const graphRetrieval = await traverseGraphForConditions(
    Array.from(conditions),
    intents,
    { familyId, weekStart },
  );

  const maxPerServing: Partial<Record<NutrientAxis, number>> = {};
  if (conditions.has("diabetes") || conditions.has("hypertension")) {
    maxPerServing.sugar = 15;
    maxPerServing.sodium = 600;
  }
  if (conditions.has("cholesterol")) {
    maxPerServing.saturatedFat = 5;
  }

  const nutrientLimits: Partial<Record<NutrientAxis, number>> = {
    sodium: 2300 * 7,
    sugar: 50 * 7,
    saturatedFat: 20 * 7,
    glycemicIndex: 55,
  };

  const tagWeights = new Map<string, number>();
  for (const [tag, info] of Array.from(graphRetrieval.requiredTags.entries())) {
    tagWeights.set(tag, info.weight);
  }
  for (const [tag, w] of Array.from(graphRetrieval.preferredTags.entries())) {
    tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + w);
  }

  return {
    familyId,
    activeMembers: members,
    extractedContext: ctx.extractedContext,
    cuisineMood,
    hardConstraints: {
      excludeTags: Array.from(graphRetrieval.avoidTags),
      excludeAllergens,
      maxPerServing,
      requireVegetarian,
    },
    softTargets: {
      weeklyRda: mergeWeeklyTargets(members),
      nutrientLimits,
      tagWeights,
    },
    intents,
    graphRetrieval,
  };
}

export function getNutrientGapsFromState(state: HouseholdState) {
  return calculateNutrientGaps(state.activeMembers);
}
