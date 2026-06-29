import type { ActiveMember } from "@/lib/types";
import { CRITICAL_NUTRIENT_THRESHOLD } from "@/lib/basket-config";

interface CoverageItem {
  quantity: number;
  nutrients: {
    ironMg: number;
    fiberG: number;
    vitaminCMg: number;
    proteinG: number;
    calciumMg: number;
  };
}

export function applyFairnessPass<T extends CoverageItem>(
  items: T[],
  members: ActiveMember[],
  computeCoverage: (member: ActiveMember, items: T[]) => number,
  swapCandidate: (items: T[], member: ActiveMember) => T | null,
): T[] {
  if (members.length <= 1) return items;

  let working = [...items];
  for (let pass = 0; pass < 2; pass++) {
    for (const member of members) {
      const cov = computeCoverage(member, working);
      if (cov >= CRITICAL_NUTRIENT_THRESHOLD) continue;
      const swap = swapCandidate(working, member);
      if (swap && !working.some((i) => i === swap)) {
        const lowest = [...working].sort((a, b) =>
          computeCoverage(member, [a]) - computeCoverage(member, [b]),
        )[0];
        if (lowest) {
          const idx = working.indexOf(lowest);
          working[idx] = swap;
        }
      }
    }
  }
  return working;
}
