import { readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "./prisma-client";
import type { KgEdgeRelation, KgNodeType } from "@prisma/client";

interface HealthRuleInput {
  condition: string;
  action: string;
  targetTag: string;
  scoreImpact: number;
  reason: string;
  source: string;
  autoExpireDays?: number | null;
}

const MOOD_MAP: Record<string, { tags: string[]; scoreBoost: number }> = {
  bbq: { tags: ["bbq_friendly"], scoreBoost: 8 },
  light_fresh: { tags: ["light_meal", "hydrating"], scoreBoost: 8 },
  hot_weather: { tags: ["hydrating", "light_meal"], scoreBoost: 7 },
  keto: { tags: ["low_glycemic", "high_protein"], scoreBoost: 8 },
  meal_prep: { tags: ["high_protein"], scoreBoost: 7 },
};

async function upsertNode(
  type: KgNodeType,
  key: string,
  label: string,
  metadata?: object,
): Promise<string> {
  const node = await prisma.kgNode.upsert({
    where: { key },
    create: { type, key, label, metadata: metadata ?? undefined },
    update: { type, label, metadata: metadata ?? undefined },
  });
  return node.id;
}

async function upsertEdge(
  fromKey: string,
  toKey: string,
  relation: KgEdgeRelation,
  weight: number,
  reason?: string,
  source?: string,
): Promise<void> {
  const fromNode = await prisma.kgNode.findUnique({ where: { key: fromKey } });
  const toNode = await prisma.kgNode.findUnique({ where: { key: toKey } });
  if (!fromNode || !toNode) return;

  await prisma.kgEdge.upsert({
    where: {
      fromNodeId_toNodeId_relation: {
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        relation,
      },
    },
    create: {
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      relation,
      weight,
      reason,
      source,
    },
    update: { weight, reason, source },
  });
}

function actionToRelation(action: string): KgEdgeRelation {
  if (action === "avoid") return "AVOIDS";
  if (action === "limit") return "LIMITS";
  return "REQUIRES";
}

export async function seedKnowledgeGraph(): Promise<void> {
  const path = resolve(process.cwd(), "data/rules/health_conditions.json");
  const rules = JSON.parse(readFileSync(path, "utf8")) as HealthRuleInput[];

  const conditionsSeen = new Set<string>();
  const tagsSeen = new Set<string>();

  for (const r of rules) {
    conditionsSeen.add(r.condition);
    tagsSeen.add(r.targetTag);
  }

  for (const cond of conditionsSeen) {
    const metaRules = rules.filter((r) => r.condition === cond);
    const autoExpire = metaRules.find((r) => r.autoExpireDays != null)?.autoExpireDays;
    await upsertNode("clinical_concept", `condition:${cond}`, cond, {
      autoExpireDays: autoExpire ?? null,
      source: metaRules[0]?.source,
    });
  }

  for (const tag of tagsSeen) {
    await upsertNode("tag", `tag:${tag}`, tag);
  }

  for (const r of rules) {
    const rel = actionToRelation(r.action);
    const weight = Math.abs(r.scoreImpact) / 10;
    await upsertEdge(
      `condition:${r.condition}`,
      `tag:${r.targetTag}`,
      rel,
      weight,
      r.reason,
      r.source,
    );
    if (r.action === "boost") {
      await upsertEdge(
        `condition:${r.condition}`,
        `tag:${r.targetTag}`,
        "SATISFIED_BY",
        weight * 0.5,
        r.reason,
        r.source,
      );
    }
  }

  for (const [intent, cfg] of Object.entries(MOOD_MAP)) {
    await upsertNode("intent", `intent:${intent}`, intent);
    for (const tag of cfg.tags) {
      if (!tagsSeen.has(tag)) {
        await upsertNode("tag", `tag:${tag}`, tag);
      }
      await upsertEdge(
        `intent:${intent}`,
        `tag:${tag}`,
        "PREFERS",
        cfg.scoreBoost / 10,
        `Mood/intent ${intent}`,
        "mood-tags",
      );
    }
  }

  console.log(
    `Knowledge graph seeded: ${conditionsSeen.size} conditions, ${tagsSeen.size} tags, ${Object.keys(MOOD_MAP).length} intents`,
  );
}

if (require.main === module) {
  import("./load-env")
    .then(() => seedKnowledgeGraph())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
