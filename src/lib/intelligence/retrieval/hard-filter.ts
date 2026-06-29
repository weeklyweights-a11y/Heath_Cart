import type { HouseholdState, ProductWithNutrition } from "../types";
import type { NutrientAxis } from "../types";

const ALLERGEN_TAG_MAP: Record<string, string[]> = {
  peanut: ["contains_peanuts", "peanut"],
  gluten: ["contains_gluten", "gluten"],
  dairy: ["contains_dairy", "lactose"],
  shellfish: ["contains_shellfish"],
  soy: ["contains_soy"],
};

function perServingValue(
  per100g: number | null | undefined,
  weightValue: number,
): number {
  if (per100g == null) return 0;
  return (per100g * weightValue) / 100;
}

function productTags(product: ProductWithNutrition): Set<string> {
  return new Set(product.tags.map((t) => t.tag));
}

function matchesAllergen(tags: Set<string>, allergen: string): boolean {
  const lower = allergen.toLowerCase();
  for (const [key, tagList] of Object.entries(ALLERGEN_TAG_MAP)) {
    if (lower.includes(key) && tagList.some((t) => tags.has(t))) return true;
  }
  if (tags.has(lower.replace(/\s+/g, "_"))) return true;
  return false;
}

function exceedsNutrientCap(
  product: ProductWithNutrition,
  axis: NutrientAxis,
  cap: number,
): boolean {
  const variant = product.variants[0];
  if (!variant || !product.nutrition) return false;
  const n = product.nutrition;
  const w = variant.weightValue;

  const values: Record<NutrientAxis, number | null | undefined> = {
    fiber: n.fiberG,
    protein: n.proteinG,
    iron: n.ironMg,
    vitaminC: n.vitaminCMg,
    calcium: n.calciumMg,
    sodium: n.sodiumMg,
    sugar: n.sugarG,
    saturatedFat: n.saturatedFatG,
    glycemicIndex: n.glycemicIndex,
  };

  const val = values[axis];
  if (axis === "glycemicIndex") {
    return val != null && val > cap;
  }
  return perServingValue(val, w) > cap;
}

export function passesHardFilter(
  product: ProductWithNutrition,
  state: HouseholdState,
): { pass: boolean; reasons: string[] } {
  const tags = productTags(product);
  const reasons: string[] = [];
  const { hardConstraints, graphRetrieval } = state;

  for (const avoid of Array.from(graphRetrieval.avoidTags)) {
    if (tags.has(avoid)) {
      reasons.push(`Avoid tag: ${avoid}`);
    }
  }

  for (const exclude of hardConstraints.excludeTags) {
    if (tags.has(exclude)) {
      reasons.push(`Hard exclude tag: ${exclude}`);
    }
  }

  for (const allergen of hardConstraints.excludeAllergens) {
    if (matchesAllergen(tags, allergen)) {
      reasons.push(`Allergen: ${allergen}`);
    }
  }

  if (hardConstraints.requireVegetarian && tags.has("non_vegetarian")) {
    reasons.push("Vegetarian household — non_vegetarian excluded");
  }

  for (const [axis, cap] of Object.entries(hardConstraints.maxPerServing) as [
    NutrientAxis,
    number,
  ][]) {
    if (exceedsNutrientCap(product, axis, cap)) {
      reasons.push(`Exceeds ${axis} cap (${cap})`);
    }
  }

  return { pass: reasons.length === 0, reasons };
}

export function filterProducts(
  products: ProductWithNutrition[],
  state: HouseholdState,
): ProductWithNutrition[] {
  return products.filter((p) => passesHardFilter(p, state).pass);
}
