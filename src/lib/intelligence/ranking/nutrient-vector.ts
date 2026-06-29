import type { NutritionLookup } from "@prisma/client";
import type { NutrientAxis } from "../types";
import type { WeeklyTargets } from "@/lib/rda";

export type NutrientVector = Record<NutrientAxis, number>;

const BOOST_AXES: NutrientAxis[] = [
  "fiber",
  "protein",
  "iron",
  "vitaminC",
  "calcium",
];

const LIMIT_AXES: NutrientAxis[] = [
  "sodium",
  "sugar",
  "saturatedFat",
  "glycemicIndex",
];

const FIELD_MAP: Record<
  NutrientAxis,
  keyof Pick<
    NutritionLookup,
    | "fiberG"
    | "proteinG"
    | "ironMg"
    | "vitaminCMg"
    | "calciumMg"
    | "sodiumMg"
    | "sugarG"
    | "saturatedFatG"
    | "glycemicIndex"
  >
> = {
  fiber: "fiberG",
  protein: "proteinG",
  iron: "ironMg",
  vitaminC: "vitaminCMg",
  calcium: "calciumMg",
  sodium: "sodiumMg",
  sugar: "sugarG",
  saturatedFat: "saturatedFatG",
  glycemicIndex: "glycemicIndex",
};

const DEFAULT_LIMITS: Partial<Record<NutrientAxis, number>> = {
  sodium: 600,
  sugar: 15,
  saturatedFat: 5,
  glycemicIndex: 55,
};

export function perServingNutrient(
  nutrition: NutritionLookup | null,
  axis: NutrientAxis,
  weightValue: number,
): number | null {
  if (!nutrition) return null;
  const field = FIELD_MAP[axis];
  const raw = nutrition[field];
  if (raw == null) return null;
  if (axis === "glycemicIndex") return raw;
  return (Number(raw) * weightValue) / 100;
}

export function buildIdealVector(
  weeklyRda: WeeklyTargets,
  axisWeights: Map<NutrientAxis, number>,
  nutrientLimits: Partial<Record<NutrientAxis, number>>,
): NutrientVector {
  const vec = emptyVector();

  const boostTargets: Record<NutrientAxis, number> = {
    fiber: weeklyRda.fiberG / 7,
    protein: weeklyRda.proteinG / 7,
    iron: weeklyRda.ironMg / 7,
    vitaminC: weeklyRda.vitaminCMg / 7,
    calcium: weeklyRda.calciumMg / 7,
    sodium: nutrientLimits.sodium ?? DEFAULT_LIMITS.sodium!,
    sugar: nutrientLimits.sugar ?? DEFAULT_LIMITS.sugar!,
    saturatedFat: nutrientLimits.saturatedFat ?? DEFAULT_LIMITS.saturatedFat!,
    glycemicIndex: nutrientLimits.glycemicIndex ?? DEFAULT_LIMITS.glycemicIndex!,
  };

  for (const axis of BOOST_AXES) {
    const w = Math.max(0.1, axisWeights.get(axis) ?? 1);
    vec[axis] = w;
  }
  for (const axis of LIMIT_AXES) {
    const w = Math.max(0, axisWeights.get(axis) ?? 0);
    if (w > 0) vec[axis] = w;
  }

  void boostTargets;
  return normalizeVector(vec);
}

export function buildProductVector(
  nutrition: NutritionLookup | null,
  weightValue: number,
  weeklyRda: WeeklyTargets,
  nutrientLimits: Partial<Record<NutrientAxis, number>>,
): NutrientVector {
  const vec = emptyVector();
  if (!nutrition) return vec;

  const dailyRda = {
    fiber: weeklyRda.fiberG / 7,
    protein: weeklyRda.proteinG / 7,
    iron: weeklyRda.ironMg / 7,
    vitaminC: weeklyRda.vitaminCMg / 7,
    calcium: weeklyRda.calciumMg / 7,
  };

  for (const axis of BOOST_AXES) {
    const actual = perServingNutrient(nutrition, axis, weightValue);
    const target = dailyRda[axis as keyof typeof dailyRda];
    vec[axis] = actual == null ? 0 : Math.min(1, actual / Math.max(target, 0.01));
  }

  for (const axis of LIMIT_AXES) {
    const actual = perServingNutrient(nutrition, axis, weightValue);
    const limit =
      nutrientLimits[axis] ??
      DEFAULT_LIMITS[axis] ??
      (axis === "glycemicIndex" ? 55 : 100);
    if (actual == null) {
      vec[axis] = 1.0;
    } else if (axis === "glycemicIndex") {
      vec[axis] = Math.max(0, 1 - actual / limit);
    } else {
      vec[axis] = Math.max(0, 1 - actual / limit);
    }
  }

  return vec;
}

export function emptyVector(): NutrientVector {
  return {
    fiber: 0,
    protein: 0,
    iron: 0,
    vitaminC: 0,
    calcium: 0,
    sodium: 0,
    sugar: 0,
    saturatedFat: 0,
    glycemicIndex: 0,
  };
}

export function vectorMagnitude(v: NutrientVector): number {
  return Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));
}

export function normalizeVector(v: NutrientVector): NutrientVector {
  const mag = vectorMagnitude(v);
  if (mag === 0) return v;
  const out = { ...v };
  for (const k of Object.keys(out) as NutrientAxis[]) {
    out[k] = out[k] / mag;
  }
  return out;
}

export { BOOST_AXES, LIMIT_AXES };
