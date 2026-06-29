/** Categorical tags applied in generate-tags.ts (not nutrient rules). */
export const CATEGORICAL_TAGS = [
  "vegetarian",
  "non_vegetarian",
  "easily_digestible",
  "hydrating",
  "light_meal",
  "bbq_friendly",
  "gluten_free",
  "dairy_free",
  "peanut_free",
  "contains_peanut",
  "contains_gluten",
  "high_goitrogen",
  "selenium_rich",
  "magnesium_rich",
  "low_glycemic",
  "diabetic_friendly",
] as const;

export type CategoricalTag = (typeof CATEGORICAL_TAGS)[number];

/** All tags referenced by health rules or dietary rules. */
export const TAG_VOCABULARY = [
  ...CATEGORICAL_TAGS,
  "iron_rich",
  "high_fiber",
  "high_protein",
  "vitamin_c_rich",
  "low_calorie",
  "high_sodium",
  "high_sugar",
  "calcium_rich",
  "folate_rich",
  "high_saturated_fat",
  "potassium_rich",
] as const;

export type TagName = (typeof TAG_VOCABULARY)[number];

export function isKnownTag(tag: string): tag is TagName {
  return (TAG_VOCABULARY as readonly string[]).includes(tag);
}

export function isCategoricalTag(tag: string): tag is CategoricalTag {
  return (CATEGORICAL_TAGS as readonly string[]).includes(tag);
}
