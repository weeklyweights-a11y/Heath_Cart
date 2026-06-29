import type { NutritionLookup } from "@prisma/client";

export function nutritionalDensityScore(
  nutrition: NutritionLookup,
  isSeasonal: boolean,
  currentMonth: number,
  availableMonths: number[],
): number {
  let score = 0;
  score += Math.min((nutrition.fiberG ?? 0) * 4, 20);
  score += Math.min((nutrition.ironMg ?? 0) * 2, 15);
  score += Math.min((nutrition.proteinG ?? 0) * 1.5, 15);
  score += Math.min((nutrition.vitaminCMg ?? 0) * 0.5, 10);

  if (isSeasonal && availableMonths.includes(currentMonth)) {
    score += 10;
  }

  return score;
}

export function allMembersHealthy(
  members: { effectiveConditions: string[] }[],
): boolean {
  return members.every((m) => m.effectiveConditions.length === 0);
}
