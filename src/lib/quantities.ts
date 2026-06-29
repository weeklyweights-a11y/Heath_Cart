import type { Product, ProductVariant } from "@prisma/client";
import type { ActiveMember, NutrientGaps } from "./types";
import { shelfLifeDays, WEEKLY_SERVINGS_PER_PERSON } from "./shelf-life";

export interface QuantityResult {
  variantId: string;
  quantity: number;
  reasoning: string;
  unitPrice: number;
}

function gramsPerVariant(v: ProductVariant): number {
  if (v.weightUnit === "lb") return v.weightValue * 453.592;
  if (v.weightUnit === "oz") return v.weightValue * 28.3495;
  if (v.weightUnit === "kg") return v.weightValue * 1000;
  return v.weightValue;
}

export function calculateQuantity(
  product: Product & { nutrition: { fiberG: number | null; ironMg: number | null; vitaminCMg: number | null; proteinG: number | null } | null },
  variants: ProductVariant[],
  activeMembers: ActiveMember[],
  gaps: NutrientGaps,
  options?: { budgetTight?: boolean; highNeed?: boolean },
): QuantityResult | null {
  if (variants.length === 0) return null;

  const headcount = Math.max(activeMembers.length, 1);
  const baseServings =
    (WEEKLY_SERVINGS_PER_PERSON[product.category] ?? 5) * headcount;

  let targetUnits = baseServings / 7;

  const n = product.nutrition;
  if (n) {
    if ((n.fiberG ?? 0) > 2 && gaps.fiberG > 0) targetUnits *= 1.2;
    if ((n.ironMg ?? 0) > 1 && gaps.ironMg > 0) targetUnits *= 1.15;
    if ((n.vitaminCMg ?? 0) > 10 && gaps.vitaminCMg > 0) targetUnits *= 1.1;
  }

  const shelfDays = shelfLifeDays(product.category);
  const maxPerishable = shelfDays / 7;
  if (product.category === "Vegetables" || product.category === "Fruits") {
    targetUnits = Math.min(targetUnits, maxPerishable * headcount);
  }

  const sorted = [...variants].sort(
    (a, b) => gramsPerVariant(a) - gramsPerVariant(b),
  );

  let chosen = sorted[0];
  for (const v of sorted) {
    if (gramsPerVariant(v) >= targetUnits * 200) {
      chosen = v;
      break;
    }
    chosen = v;
  }

  if (options?.budgetTight && sorted.length > 1) {
    chosen = sorted[0];
  } else if (options?.highNeed && sorted.length > 1) {
    chosen = sorted[sorted.length - 1];
  }

  let quantity = Math.max(1, Math.round(targetUnits));
  if (options?.budgetTight) quantity = Math.max(1, Math.floor(quantity * 0.75));

  return {
    variantId: chosen.id,
    quantity,
    reasoning: `Scaled for ${headcount} active member(s); snapped to ${chosen.weightValue} ${chosen.weightUnit}.`,
    unitPrice: Number(chosen.price),
  };
}

export function scaleQuantityForBudget(
  quantity: number,
  factor: number,
): number {
  return Math.max(1, Math.floor(quantity * factor));
}
