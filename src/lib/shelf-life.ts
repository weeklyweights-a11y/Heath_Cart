const SHELF_DAYS: Record<string, number> = {
  Vegetables: 5,
  Fruits: 5,
  Proteins: 4,
  Dairy: 7,
  Grains: 14,
  Pantry: 365,
  Snacks: 30,
};

export function shelfLifeDays(category: string): number {
  return SHELF_DAYS[category] ?? 7;
}

/** Base weekly servings per person by category (USDA-inspired). */
export const WEEKLY_SERVINGS_PER_PERSON: Record<string, number> = {
  Vegetables: 14,
  Fruits: 10,
  Proteins: 7,
  Grains: 7,
  Dairy: 7,
  Pantry: 3,
  Snacks: 2,
};
