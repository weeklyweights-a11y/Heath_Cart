import { passesHardFilter } from "../retrieval/hard-filter";
import type { HouseholdState, ProductWithNutrition, SafetyAuditResult } from "../types";

export function auditBasketProducts(
  products: ProductWithNutrition[],
  state: HouseholdState,
): SafetyAuditResult {
  const violations: string[] = [];
  for (const p of products) {
    const { pass, reasons } = passesHardFilter(p, state);
    if (!pass) violations.push(`${p.nameEn}: ${reasons.join("; ")}`);
  }
  return { pass: violations.length === 0, violations };
}

export function auditProductIds(
  productRows: ProductWithNutrition[],
  state: HouseholdState,
): SafetyAuditResult {
  return auditBasketProducts(productRows, state);
}
