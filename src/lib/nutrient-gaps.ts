import type { ActiveMember, NutrientGaps } from "./types";
import {
  PANTRY_BASELINE_COVERAGE,
  weeklyTargetsForMember,
} from "./rda";

export function calculateNutrientGaps(
  activeMembers: ActiveMember[],
): NutrientGaps {
  const totals = {
    ironMg: 0,
    fiberG: 0,
    vitaminCMg: 0,
    proteinG: 0,
    calciumMg: 0,
  };

  for (const m of activeMembers) {
    const t = weeklyTargetsForMember(m.age, m.relation);
    totals.ironMg += t.ironMg;
    totals.fiberG += t.fiberG;
    totals.vitaminCMg += t.vitaminCMg;
    totals.proteinG += t.proteinG;
    totals.calciumMg += t.calciumMg;
  }

  const factor = 1 - PANTRY_BASELINE_COVERAGE;
  return {
    ironMg: totals.ironMg * factor,
    fiberG: totals.fiberG * factor,
    vitaminCMg: totals.vitaminCMg * factor,
    proteinG: totals.proteinG * factor,
    calciumMg: totals.calciumMg * factor,
  };
}

export function memberSeverityWeight(conditions: string[]): number {
  const severe = ["diabetes", "celiac", "cholesterol", "anemia", "obesity"];
  if (conditions.some((c) => severe.includes(c))) return 1.5;
  return 1;
}
