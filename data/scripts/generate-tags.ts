import "./load-env";
import { readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "./prisma-client";
import type { NutritionLookup, DietaryTagRule } from "@prisma/client";

interface AllergenEntry {
  containsGluten: boolean;
  containsPeanut: boolean;
  containsDairy: boolean;
}

const MEAT_FISH = ["chicken", "turkey", "salmon", "beef", "pork", "fish", "shrimp", "tuna", "egg"];
const CRUCIFEROUS = ["broccoli", "cauliflower", "kale", "brussels", "cabbage", "bok choy"];
const SELENIUM_FOODS = ["brazil nut", "tuna", "salmon", "sardine", "halibut"];
const HYDRATING = ["watermelon", "cucumber", "celery", "strawberr", "orange", "lettuce", "melon"];
const BBQ_FOODS = ["chicken", "turkey", "salmon", "beef", "corn", "bell pepper", "zucchini"];
const LIGHT_MEAL = ["salad", "lettuce", "spinach", "kale", "cucumber", "broth", "yogurt"];
const DIGESTIBLE = ["banana", "rice", "oat", "applesauce", "yogurt", "toast", "cracker", "broth"];

function loadAllergenMap(): Record<string, AllergenEntry> {
  const p = resolve(process.cwd(), "data/products/allergen-map.json");
  return JSON.parse(readFileSync(p, "utf8")) as Record<string, AllergenEntry>;
}

function compare(
  value: number | null | undefined,
  operator: string | null,
  threshold: number | null,
): boolean {
  if (value == null || operator == null || threshold == null) return false;
  switch (operator) {
    case "gt":
      return value > threshold;
    case "lt":
      return value < threshold;
    case "gte":
      return value >= threshold;
    case "lte":
      return value <= threshold;
    default:
      return false;
  }
}

function evalNutrientRules(
  nutrition: NutritionLookup,
  rules: DietaryTagRule[],
): Set<string> {
  const tags = new Set<string>();

  for (const rule of rules) {
    if (!rule.isActive || !rule.nutrientColumn) continue;
    const col = rule.nutrientColumn;
    const val = (nutrition as unknown as Record<string, number | null>)[col];

    if (rule.tagName === "low_glycemic") {
      if (nutrition.glycemicIndex != null && nutrition.glycemicIndex < 55) {
        tags.add("low_glycemic");
      } else if (
        nutrition.glycemicIndex == null &&
        (nutrition.sugarG ?? 99) < 10 &&
        (nutrition.fiberG ?? 0) > 2
      ) {
        tags.add("low_glycemic");
      }
      continue;
    }

    if (rule.tagName === "diabetic_friendly") {
      if ((nutrition.sugarG ?? 99) < 5 && (nutrition.fiberG ?? 0) > 2) {
        tags.add("diabetic_friendly");
      }
      continue;
    }

    if (compare(val, rule.operator, rule.threshold)) {
      tags.add(rule.tagName);
    }
  }

  if ((nutrition.magnesiumMg ?? 0) > 50) tags.add("magnesium_rich");

  return tags;
}

function evalCategorical(
  nameEn: string,
  category: string,
  nutrition: NutritionLookup,
  allergen: AllergenEntry | undefined,
): Set<string> {
  const tags = new Set<string>();
  const lower = nameEn.toLowerCase();
  const group = (nutrition.foodGroup ?? "").toLowerCase();

  const isMeat =
    MEAT_FISH.some((m) => lower.includes(m)) ||
    category === "Proteins" && !lower.includes("tofu") && !lower.includes("bean") && !lower.includes("lentil") && !lower.includes("chickpea");

  if (
    category === "Vegetables" ||
    category === "Fruits" ||
    lower.includes("tofu") ||
    lower.includes("bean") ||
    lower.includes("lentil") ||
    lower.includes("chickpea") ||
    lower.includes("nut") && !lower.includes("peanut")
  ) {
    if (!isMeat || lower.includes("egg") === false) {
      if (!lower.includes("chicken") && !lower.includes("salmon") && !lower.includes("turkey")) {
        tags.add("vegetarian");
      }
    }
  }

  if (isMeat || lower.includes("egg") && !lower.includes("plant")) {
    tags.add("non_vegetarian");
  }

  if (allergen) {
    if (!allergen.containsGluten) tags.add("gluten_free");
    else tags.add("contains_gluten");
    if (!allergen.containsPeanut) tags.add("peanut_free");
    else tags.add("contains_peanut");
    if (!allergen.containsDairy) tags.add("dairy_free");
  } else {
    tags.add("gluten_free");
    tags.add("peanut_free");
    if (category !== "Dairy") tags.add("dairy_free");
  }

  if (CRUCIFEROUS.some((c) => lower.includes(c))) tags.add("high_goitrogen");
  if (SELENIUM_FOODS.some((s) => lower.includes(s))) tags.add("selenium_rich");
  if (HYDRATING.some((h) => lower.includes(h))) tags.add("hydrating");
  if (BBQ_FOODS.some((b) => lower.includes(b))) tags.add("bbq_friendly");
  if (LIGHT_MEAL.some((l) => lower.includes(l))) tags.add("light_meal");
  if (DIGESTIBLE.some((d) => lower.includes(d))) tags.add("easily_digestible");

  if (
    nutrition.glycemicIndex == null &&
    (nutrition.sugarG ?? 99) < 10 &&
    (nutrition.fiberG ?? 0) > 2
  ) {
    tags.add("low_glycemic");
  }

  if ((nutrition.sugarG ?? 99) < 5 && (nutrition.fiberG ?? 0) > 2) {
    tags.add("diabetic_friendly");
  }

  if ((nutrition.magnesiumMg ?? 0) > 50) tags.add("magnesium_rich");

  return tags;
}

async function main(): Promise<void> {
  const allergenMap = loadAllergenMap();
  const rules = await prisma.dietaryTagRule.findMany({ where: { isActive: true } });
  const products = await prisma.product.findMany({
    include: { nutrition: true },
  });

  let totalTags = 0;

  for (const product of products) {
    const nutrientTags = evalNutrientRules(product.nutrition, rules);
    const catTags = evalCategorical(
      product.nameEn,
      product.category,
      product.nutrition,
      allergenMap[product.nameEn],
    );
    const allTags = new Set([...nutrientTags, ...catTags]);

    await prisma.dietaryTag.deleteMany({ where: { productId: product.id } });
    if (allTags.size) {
      await prisma.dietaryTag.createMany({
        data: [...allTags].map((tag) => ({ productId: product.id, tag })),
        skipDuplicates: true,
      });
      totalTags += allTags.size;
    }
  }

  const distinct = await prisma.dietaryTag.groupBy({ by: ["tag"] });
  console.log(`Tagged ${products.length} products, ${totalTags} tag rows`);
  console.log(`Distinct tags: ${distinct.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
