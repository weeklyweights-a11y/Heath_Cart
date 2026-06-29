import type { MemberRelation } from "@prisma/client";

export type Sex = "male" | "female";

export interface WeeklyTargets {
  ironMg: number;
  fiberG: number;
  vitaminCMg: number;
  proteinG: number;
  calciumMg: number;
}

/** Infer sex from relation + age for USDA DRI defaults. */
export function inferSex(relation: MemberRelation, age: number): Sex {
  if (age < 18) return "male";
  if (relation === "spouse") return "female";
  if (relation === "self") return "male";
  if (relation === "child") return "male";
  return "female";
}

function ageBand(age: number): "child" | "teen" | "adult" | "older" {
  if (age < 9) return "child";
  if (age < 18) return "teen";
  if (age < 51) return "adult";
  return "older";
}

/** USDA DRI weekly targets (daily * 7, simplified). */
export function weeklyTargetsForMember(
  age: number,
  relation: MemberRelation,
): WeeklyTargets {
  const sex = inferSex(relation, age);
  const band = ageBand(age);

  if (band === "child" || band === "teen") {
    return {
      ironMg: 8 * 7,
      fiberG: 19,
      vitaminCMg: 35 * 7,
      proteinG: 34 * 7,
      calciumMg: 1000 * 7,
    };
  }

  if (sex === "female") {
    return {
      ironMg: 18 * 7,
      fiberG: 25,
      vitaminCMg: 75 * 7,
      proteinG: 46 * 7,
      calciumMg: 1000 * 7,
    };
  }

  return {
    ironMg: 8 * 7,
    fiberG: 28,
    vitaminCMg: 90 * 7,
    proteinG: 56 * 7,
    calciumMg: 1000 * 7,
  };
}

export const PANTRY_BASELINE_COVERAGE = 0.25;
