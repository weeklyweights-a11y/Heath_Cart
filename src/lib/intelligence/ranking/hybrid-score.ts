import type { HealthBadge } from "@/lib/types";
import type { GraphRetrievalResult, HouseholdState, ScoreBreakdown } from "../types";
import { scoreNutrientCosine } from "./cosine-rank";
import type { ProductWithNutrition } from "../types";

export function scoreGraphMatch(
  productTags: Set<string>,
  graph: GraphRetrievalResult,
): { score: number; paths: string[][] } {
  const required = graph.requiredTags;
  if (required.size === 0) return { score: 0.5, paths: [] };

  let matchedWeight = 0;
  let totalWeight = 0;
  const paths: string[][] = [];

  for (const [tag, info] of Array.from(required.entries())) {
    totalWeight += info.weight;
    if (productTags.has(tag)) {
      matchedWeight += info.weight;
      paths.push(info.path);
    }
  }

  for (const [tag, w] of Array.from(graph.preferredTags.entries())) {
    if (productTags.has(tag)) matchedWeight += w * 0.5;
    totalWeight += w * 0.5;
  }

  const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;
  return { score: Math.min(1, score), paths };
}

export function scoreSeasonal(
  isSeasonal: boolean,
  availableMonths: number[],
  referenceMonth: number,
): number {
  if (!isSeasonal) return 0.5;
  if (availableMonths.includes(referenceMonth)) return 1;
  return 0.2;
}

export interface HybridScoreInput {
  product: ProductWithNutrition;
  state: HouseholdState;
  semanticScore?: number;
  referenceMonth: number;
}

export function computeHybridScore(input: HybridScoreInput): {
  finalScore: number;
  breakdown: ScoreBreakdown;
} {
  const { product, state, semanticScore = 0, referenceMonth } = input;
  const tags = new Set(product.tags.map((t) => t.tag));
  const variant = product.variants[0];
  const weightValue = variant?.weightValue ?? 100;

  const scoreNutrient = scoreNutrientCosine(
    product.nutrition as import("@prisma/client").NutritionLookup | null,
    weightValue,
    state.softTargets.weeklyRda,
    state.graphRetrieval.nutrientAxisWeights,
    state.softTargets.nutrientLimits,
  );

  const { score: scoreGraph, paths } = scoreGraphMatch(tags, state.graphRetrieval);
  const scoreSeasonalVal = scoreSeasonal(
    product.isSeasonal,
    product.availableMonths,
    referenceMonth,
  );

  const finalScore =
    0.45 * scoreNutrient +
    0.3 * scoreGraph +
    0.15 * semanticScore +
    0.1 * scoreSeasonalVal;

  return {
    finalScore,
    breakdown: {
      nutrient: scoreNutrient,
      graph: scoreGraph,
      semantic: semanticScore,
      seasonal: scoreSeasonalVal,
      graphPaths: paths.length > 0 ? paths : undefined,
    },
  };
}

export function assignBadgeFromQuartiles(
  score: number,
  allScores: number[],
  hasAvoidMatch: boolean,
): HealthBadge {
  if (hasAvoidMatch) return "avoid";
  if (allScores.length === 0) return "neutral";

  const sorted = [...allScores].sort((a, b) => a - b);
  const q75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
  const q50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const q25 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;

  if (score >= q75) return "recommended";
  if (score >= q50) return "neutral";
  if (score >= q25) return "limit";
  return "avoid";
}
