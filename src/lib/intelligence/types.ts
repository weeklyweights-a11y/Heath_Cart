import type { Product, ProductVariant } from "@prisma/client";
import type { HealthBadge, ScoreBreakdown, ItemExplanation } from "@/lib/types";
import type { WeeklyTargets } from "@/lib/rda";
import type { ActiveMember, ExtractedContext } from "@/lib/types";

export type { ScoreBreakdown, ItemExplanation };

export type NutrientAxis =
  | "fiber"
  | "protein"
  | "iron"
  | "vitaminC"
  | "calcium"
  | "sodium"
  | "sugar"
  | "saturatedFat"
  | "glycemicIndex";

export interface GraphPathEntry {
  path: string[];
  reason: string;
  weight: number;
}

export interface GraphRetrievalResult {
  requiredTags: Map<string, { weight: number; reason: string; path: string[] }>;
  avoidTags: Set<string>;
  preferredTags: Map<string, number>;
  nutrientAxisWeights: Map<NutrientAxis, number>;
  graphPaths: GraphPathEntry[];
}

export interface HouseholdState {
  familyId: string;
  activeMembers: ActiveMember[];
  extractedContext: ExtractedContext;
  cuisineMood: string | null;
  hardConstraints: {
    excludeTags: string[];
    excludeAllergens: string[];
    maxPerServing: Partial<Record<NutrientAxis, number>>;
    requireVegetarian: boolean;
  };
  softTargets: {
    weeklyRda: WeeklyTargets;
    nutrientLimits: Partial<Record<NutrientAxis, number>>;
    tagWeights: Map<string, number>;
  };
  intents: string[];
  graphRetrieval: GraphRetrievalResult;
}

export interface ScoredProductV2 {
  productId: string;
  score: number;
  badge: HealthBadge;
  reasoning: string[];
  scoreBreakdown: ScoreBreakdown;
}

export interface RefinedIntent {
  hard: { allergies: string[]; avoids: string[] };
  soft: {
    mood?: string;
    dietaryNeeds: string[];
    budgetUsd?: number;
  };
  householdChanges: ExtractedContext["household_changes"];
  healthStates: ExtractedContext["health_states"];
  confidence: number;
}

export interface SafetyAuditResult {
  pass: boolean;
  violations: string[];
}

export type ProductWithNutrition = Product & {
  tags: { tag: string }[];
  variants: ProductVariant[];
  nutrition: {
    fiberG: number | null;
    proteinG: number | null;
    ironMg: number | null;
    vitaminCMg: number | null;
    calciumMg: number | null;
    sodiumMg: number | null;
    sugarG: number | null;
    saturatedFatG: number | null;
    glycemicIndex: number | null;
  } | null;
};
