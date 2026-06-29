import {
  buildIdealVector,
  buildProductVector,
  normalizeVector,
  vectorMagnitude,
  type NutrientVector,
} from "./nutrient-vector";
import type { NutritionLookup } from "@prisma/client";
import type { NutrientAxis } from "../types";
import type { WeeklyTargets } from "@/lib/rda";

export function cosineSimilarity(a: NutrientVector, b: NutrientVector): number {
  const keys = Object.keys(a) as NutrientAxis[];
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const k of keys) {
    dot += a[k] * b[k];
    magA += a[k] * a[k];
    magB += b[k] * b[k];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function scoreNutrientCosine(
  nutrition: NutritionLookup | null,
  weightValue: number,
  weeklyRda: WeeklyTargets,
  axisWeights: Map<NutrientAxis, number>,
  nutrientLimits: Partial<Record<NutrientAxis, number>>,
): number {
  const ideal = buildIdealVector(weeklyRda, axisWeights, nutrientLimits);
  const product = buildProductVector(nutrition, weightValue, weeklyRda, nutrientLimits);

  const productMag = vectorMagnitude(product);
  if (productMag === 0) return 0;

  const normIdeal = normalizeVector(ideal);
  const normProduct = normalizeVector(product);
  return cosineSimilarity(normIdeal, normProduct);
}
