import { describe, it, expect } from "vitest";
import { passesHardFilter } from "../retrieval/hard-filter";
import type { HouseholdState, ProductWithNutrition } from "../types";

function baseState(overrides?: Partial<HouseholdState>): HouseholdState {
  return {
    familyId: "f1",
    activeMembers: [],
    extractedContext: {
      household_changes: [],
      membersAway: [],
      health_states: [],
      dietary_needs: [],
      practical_needs: [],
    },
    cuisineMood: null,
    hardConstraints: {
      excludeTags: [],
      excludeAllergens: [],
      maxPerServing: {},
      requireVegetarian: false,
    },
    softTargets: {
      weeklyRda: { ironMg: 56, fiberG: 28, vitaminCMg: 630, proteinG: 392, calciumMg: 7000 },
      nutrientLimits: {},
      tagWeights: new Map(),
    },
    intents: [],
    graphRetrieval: {
      requiredTags: new Map(),
      avoidTags: new Set(),
      preferredTags: new Map(),
      nutrientAxisWeights: new Map(),
      graphPaths: [],
    },
    ...overrides,
  };
}

function product(tags: string[]): ProductWithNutrition {
  return {
    id: "p1",
    nameEn: "Test",
    category: "Snacks",
    isSeasonal: false,
    availableMonths: [],
    tags: tags.map((tag) => ({ tag })),
    variants: [{ id: "v1", weightValue: 100, weightUnit: "g", price: 3 }],
    nutrition: {
      fiberG: 2,
      proteinG: 5,
      ironMg: 1,
      vitaminCMg: 0,
      calciumMg: 10,
      sodiumMg: 100,
      sugarG: 5,
      saturatedFatG: 1,
      glycemicIndex: 40,
    },
  };
}

describe("hard-filter", () => {
  it("rejects peanut-tagged product for peanut allergy", () => {
    const state = baseState({
      hardConstraints: {
        excludeTags: [],
        excludeAllergens: ["peanut"],
        maxPerServing: {},
        requireVegetarian: false,
      },
      graphRetrieval: {
        ...baseState().graphRetrieval,
        avoidTags: new Set(["contains_peanuts"]),
      },
    });
    const result = passesHardFilter(product(["contains_peanuts"]), state);
    expect(result.pass).toBe(false);
  });

  it("rejects non_vegetarian for vegetarian household", () => {
    const state = baseState({
      hardConstraints: {
        excludeTags: [],
        excludeAllergens: [],
        maxPerServing: {},
        requireVegetarian: true,
      },
    });
    const result = passesHardFilter(product(["non_vegetarian"]), state);
    expect(result.pass).toBe(false);
  });

  it("rejects gluten for celiac avoid tag", () => {
    const state = baseState({
      graphRetrieval: {
        ...baseState().graphRetrieval,
        avoidTags: new Set(["contains_gluten"]),
      },
    });
    const result = passesHardFilter(product(["contains_gluten"]), state);
    expect(result.pass).toBe(false);
  });
});
