export interface MoodBoost {
  tags: string[];
  categories: string[];
  scoreBoost: number;
}

const MOOD_MAP: Record<string, MoodBoost> = {
  bbq: { tags: ["bbq_friendly"], categories: ["Proteins"], scoreBoost: 8 },
  light_fresh: {
    tags: ["light_meal", "hydrating"],
    categories: ["Vegetables", "Fruits"],
    scoreBoost: 8,
  },
  hot_weather: {
    tags: ["hydrating", "light_meal"],
    categories: ["Fruits", "Vegetables"],
    scoreBoost: 7,
  },
  keto: {
    tags: ["low_glycemic", "high_protein"],
    categories: ["Proteins", "Vegetables"],
    scoreBoost: 8,
  },
  meal_prep: {
    tags: ["high_protein"],
    categories: ["Proteins", "Grains"],
    scoreBoost: 7,
  },
};

const DIETARY_MAP: Record<string, MoodBoost> = {
  bbq: { tags: ["bbq_friendly"], categories: ["Proteins"], scoreBoost: 10 },
  meal_prep: {
    tags: ["high_protein"],
    categories: ["Proteins"],
    scoreBoost: 8,
  },
  keto: {
    tags: ["low_glycemic"],
    categories: ["Proteins", "Vegetables"],
    scoreBoost: 8,
  },
};

export function getMoodBoosts(
  cuisineMood: string | null | undefined,
  dietaryNeeds: { requirement: string }[],
): MoodBoost[] {
  const boosts: MoodBoost[] = [];
  const seen = new Set<string>();

  const add = (key: string, source: Record<string, MoodBoost>) => {
    const normalized = key.toLowerCase().replace(/\s+/g, "_");
    for (const [k, boost] of Object.entries(source)) {
      if (normalized.includes(k) && !seen.has(k)) {
        seen.add(k);
        boosts.push(boost);
      }
    }
  };

  if (cuisineMood) add(cuisineMood, MOOD_MAP);
  for (const need of dietaryNeeds) {
    add(need.requirement, DIETARY_MAP);
  }

  return boosts;
}

export function applyMoodBoost(
  productTags: Set<string>,
  category: string,
  boosts: MoodBoost[],
): number {
  let total = 0;
  for (const boost of boosts) {
    const tagMatch = boost.tags.some((t) => productTags.has(t));
    const catMatch = boost.categories.includes(category);
    if (tagMatch || catMatch) total += boost.scoreBoost;
  }
  return total;
}
