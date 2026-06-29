import { readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "./prisma-client";
import type { HealthAction } from "@prisma/client";

interface HealthRuleInput {
  condition: string;
  action: HealthAction;
  targetTag: string;
  scoreImpact: number;
  reason: string;
  source: string;
  autoExpireDays?: number | null;
}

function validateScoreImpact(action: HealthAction, scoreImpact: number): void {
  if (action === "boost" && scoreImpact <= 0) {
    throw new Error(`boost rule must have scoreImpact > 0, got ${scoreImpact}`);
  }
  if ((action === "limit" || action === "avoid") && scoreImpact >= 0) {
    throw new Error(`${action} rule must have scoreImpact < 0, got ${scoreImpact}`);
  }
}

export async function importHealthRules(): Promise<number> {
  const path = resolve(process.cwd(), "data/rules/health_conditions.json");
  const rules = JSON.parse(readFileSync(path, "utf8")) as HealthRuleInput[];

  for (const r of rules) {
    validateScoreImpact(r.action, r.scoreImpact);
  }

  let count = 0;
  for (const r of rules) {
    await prisma.healthConditionRule.upsert({
      where: {
        condition_action_targetTag: {
          condition: r.condition,
          action: r.action,
          targetTag: r.targetTag,
        },
      },
      create: {
        condition: r.condition,
        action: r.action,
        targetTag: r.targetTag,
        scoreImpact: r.scoreImpact,
        reason: r.reason,
        source: r.source,
        autoExpireDays: r.autoExpireDays ?? null,
        isActive: true,
      },
      update: {
        scoreImpact: r.scoreImpact,
        reason: r.reason,
        source: r.source,
        autoExpireDays: r.autoExpireDays ?? null,
        isActive: true,
      },
    });
    count++;
  }
  return count;
}

if (require.main === module) {
  import("./load-env")
    .then(() => importHealthRules())
    .then((n) => {
      console.log(`Health condition rules imported: ${n}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
