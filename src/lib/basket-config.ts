export const ITEMS_PER_CATEGORY: Record<string, number> = {
  Vegetables: 7,
  Fruits: 5,
  Proteins: 5,
  Grains: 4,
  Dairy: 3,
  Pantry: 4,
  Snacks: 2,
};

export const CRITICAL_NUTRIENT_THRESHOLD = 60;

export const SEVERITY_CONDITIONS = new Set([
  "diabetes",
  "celiac",
  "cholesterol",
  "anemia",
  "obesity",
]);
