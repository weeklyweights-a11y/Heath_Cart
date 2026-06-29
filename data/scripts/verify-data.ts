import "./load-env";
import { prisma } from "./prisma-client";
import {
  CATEGORICAL_TAGS,
  TAG_VOCABULARY,
} from "../rules/tag-vocabulary";
import { getUsdaImportBaseline } from "./usda-utils";

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

async function main(): Promise<void> {
  const results: CheckResult[] = [];
  const baseline = getUsdaImportBaseline();

  const nutritionCount = await prisma.nutritionLookup.count();
  const nutritionPass =
    nutritionCount >= 2000 || nutritionCount >= baseline * 0.8;
  results.push({
    name: "1. NutritionLookup count",
    pass: nutritionPass,
    detail: `${nutritionCount} rows (baseline ${baseline}, need ≥2000 or ≥80%)`,
  });

  const conditions = await prisma.healthConditionRule.groupBy({
    by: ["condition"],
    where: { isActive: true },
  });
  results.push({
    name: "2. Health conditions",
    pass: conditions.length >= 15,
    detail: `${conditions.length} distinct conditions`,
  });

  const dietaryRuleCount = await prisma.dietaryTagRule.count({
    where: { isActive: true },
  });
  results.push({
    name: "3. DietaryTagRule count",
    pass: dietaryRuleCount >= 15,
    detail: `${dietaryRuleCount} active rules`,
  });

  const productCount = await prisma.product.count();
  results.push({
    name: "4. Product count",
    pass: productCount >= 100,
    detail: `${productCount} products`,
  });

  const variantCount = await prisma.productVariant.count();
  results.push({
    name: "5. ProductVariant count",
    pass: variantCount >= 300,
    detail: `${variantCount} variants`,
  });

  const tagCount = await prisma.dietaryTag.count();
  results.push({
    name: "6. DietaryTag count",
    pass: tagCount >= 500,
    detail: `${tagCount} tags`,
  });

  const orphanProducts = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint as count FROM "Product" p
    LEFT JOIN "NutritionLookup" n ON p."usdaFoodCode" = n."foodCode"
    WHERE n."foodCode" IS NULL
  `;
  const orphanUsda = Number(orphanProducts[0]?.count ?? 0);
  results.push({
    name: "7. Orphan USDA FK",
    pass: orphanUsda === 0,
    detail: `${orphanUsda} invalid usdaFoodCode references`,
  });

  const healthRules = await prisma.healthConditionRule.findMany({
    where: { isActive: true },
    select: { targetTag: true },
  });
  const dietaryTags = await prisma.dietaryTagRule.findMany({
    where: { isActive: true },
    select: { tagName: true },
  });
  const validTags = new Set([
    ...TAG_VOCABULARY,
    ...dietaryTags.map((d) => d.tagName),
    ...CATEGORICAL_TAGS,
  ]);
  const orphanTargetTags = healthRules.filter((h) => !validTags.has(h.targetTag));
  results.push({
    name: "8. Orphan targetTag",
    pass: orphanTargetTags.length === 0,
    detail:
      orphanTargetTags.length === 0
        ? "all targetTags valid"
        : orphanTargetTags.map((o) => o.targetTag).join(", "),
  });

  const noTags = await prisma.product.count({
    where: { tags: { none: {} } },
  });
  results.push({
    name: "9. Products without tags",
    pass: noTags === 0,
    detail: `${noTags} products missing tags`,
  });

  const noVariants = await prisma.product.count({
    where: { variants: { none: {} } },
  });
  results.push({
    name: "10. Products without variants",
    pass: noVariants === 0,
    detail: `${noVariants} products missing variants`,
  });

  console.log("\n| Check | Result | Detail |");
  console.log("|-------|--------|--------|");
  let allPass = true;
  for (const r of results) {
    const status = r.pass ? "PASS" : "FAIL";
    if (!r.pass) allPass = false;
    console.log(`| ${r.name} | ${status} | ${r.detail} |`);
  }

  if (!allPass) process.exit(1);
  console.log("\nAll checks PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
