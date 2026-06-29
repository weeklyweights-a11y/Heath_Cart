import "./load-env";
import { readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "./prisma-client";
import { importHealthRules } from "./import-health-rules";

interface DietaryTagRuleInput {
  tagName: string;
  nutrientColumn?: string | null;
  operator?: string | null;
  threshold?: number | null;
  description: string;
}

export async function importDietaryTagRules(): Promise<number> {
  const path = resolve(process.cwd(), "data/rules/dietary_tags.json");
  const rules = JSON.parse(readFileSync(path, "utf8")) as DietaryTagRuleInput[];

  let count = 0;
  for (const r of rules) {
    await prisma.dietaryTagRule.upsert({
      where: { tagName: r.tagName },
      create: {
        tagName: r.tagName,
        nutrientColumn: r.nutrientColumn ?? null,
        operator: r.operator ?? null,
        threshold: r.threshold ?? null,
        description: r.description,
        isActive: true,
      },
      update: {
        nutrientColumn: r.nutrientColumn ?? null,
        operator: r.operator ?? null,
        threshold: r.threshold ?? null,
        description: r.description,
        isActive: true,
      },
    });
    count++;
  }
  return count;
}

async function main(): Promise<void> {
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];

  if (!only || only === "health") {
    const h = await importHealthRules();
    console.log(`Health condition rules imported: ${h}`);
  }

  if (!only || only === "dietary") {
    const d = await importDietaryTagRules();
    console.log(`Dietary tag rules imported: ${d}`);
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
