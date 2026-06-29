import "./load-env";
import { prisma } from "./prisma-client";
import { isIntelligenceV2Enabled } from "../../src/lib/intelligence/config";

async function main(): Promise<void> {
  const issues: string[] = [];

  if (!isIntelligenceV2Enabled()) {
    issues.push("INTELLIGENCE_V2 is not enabled (set true on Vercel + .env.local)");
  }

  const kgNodes = await prisma.kgNode.count();
  const kgEdges = await prisma.kgEdge.count();
  if (kgNodes < 10) issues.push(`KgNode count low (${kgNodes}) — run npm run seed:kg`);
  if (kgEdges < 10) issues.push(`KgEdge count low (${kgEdges}) — run npm run seed:kg`);

  const products = await prisma.product.count({ where: { isActive: true } });
  const withFoodon = await prisma.product.count({
    where: { isActive: true, foodonId: { not: null } },
  });
  const foodonPct = products > 0 ? (withFoodon / products) * 100 : 0;
  if (foodonPct < 50) {
    issues.push(`FoodOn coverage ${foodonPct.toFixed(0)}% — run npm run map:foodon (target 80%+)`);
  }

  console.log("Intelligence v2 readiness check");
  console.log(`  INTELLIGENCE_V2: ${process.env.INTELLIGENCE_V2 ?? "(default true)"}`);
  console.log(`  KgNode/KgEdge: ${kgNodes}/${kgEdges}`);
  console.log(`  FoodOn: ${withFoodon}/${products} (${foodonPct.toFixed(0)}%)`);
  console.log(`  PGVECTOR_ENABLED: ${process.env.PGVECTOR_ENABLED ?? "false (intent→tag semantic fallback)"}`);

  if (issues.length) {
    console.error("\nIssues:");
    issues.forEach((i) => console.error("  -", i));
    process.exit(1);
  }
  console.log("\nPASS — v2 production ready");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
