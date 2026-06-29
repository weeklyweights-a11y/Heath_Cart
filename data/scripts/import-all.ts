import "./load-env";
import { prisma } from "./prisma-client";
import { CATEGORICAL_TAGS } from "../rules/tag-vocabulary";
import { importHealthRules } from "./import-health-rules";
import { importDietaryTagRules } from "./import-rules";

export async function validateTargetTags(): Promise<void> {
  const healthRules = await prisma.healthConditionRule.findMany({
    where: { isActive: true },
    select: { targetTag: true, condition: true },
  });
  const dietaryRules = await prisma.dietaryTagRule.findMany({
    where: { isActive: true },
    select: { tagName: true },
  });
  const dietarySet = new Set(dietaryRules.map((d) => d.tagName));
  const categoricalSet = new Set<string>(CATEGORICAL_TAGS);

  const orphans: string[] = [];
  for (const h of healthRules) {
    if (!dietarySet.has(h.targetTag) && !categoricalSet.has(h.targetTag)) {
      orphans.push(`${h.condition} → ${h.targetTag}`);
    }
  }

  if (orphans.length) {
    console.error("Orphan targetTag references:");
    orphans.forEach((o) => console.error("  ", o));
    throw new Error("Cross-reference validation failed");
  }
  console.log("Cross-reference validation: PASS");
}

async function runUsdaImport(): Promise<void> {
  const { execSync } = await import("child_process");
  execSync("npx tsx data/scripts/import-usda.ts", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
}

async function runSeedAndTags(): Promise<void> {
  const { execSync } = await import("child_process");
  execSync("npx tsx data/scripts/import-synthetic-foods.ts", {
    stdio: "inherit",
    env: process.env,
  });
  execSync("npm run seed:products", { stdio: "inherit", env: process.env });
  execSync("npm run generate:tags", { stdio: "inherit", env: process.env });
}

async function main(): Promise<void> {
  const withSeed = process.argv.includes("--with-seed");

  console.log("=== USDA import ===");
  await runUsdaImport();

  console.log("=== Rules import ===");
  await importHealthRules();
  await importDietaryTagRules();
  await validateTargetTags();

  if (withSeed) {
    console.log("=== Catalog seed + tags ===");
    await runSeedAndTags();
  }

  console.log("import-data complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
