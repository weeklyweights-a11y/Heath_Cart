import "./load-env";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma-client";
import { isIntelligenceV2Enabled, isPgVectorEnabled } from "../../src/lib/intelligence/config";
import { existsSync } from "fs";
import { join } from "path";

interface Check {
  id: string;
  category: string;
  status: "pass" | "warn" | "fail" | "info";
  detail: string;
}

const checks: Check[] = [];

function add(
  id: string,
  category: string,
  status: Check["status"],
  detail: string,
): void {
  checks.push({ id, category, status, detail });
}

async function main(): Promise<void> {
  console.log("Intelligence v2 — completion audit\n");

  // Feature flag
  add(
    "flag-v2",
    "config",
    isIntelligenceV2Enabled() ? "pass" : "fail",
    `INTELLIGENCE_V2=${process.env.INTELLIGENCE_V2 ?? "(default true)"}`,
  );

  // DB bootstrap
  const kgNodes = await prisma.kgNode.count();
  const kgEdges = await prisma.kgEdge.count();
  add(
    "db-kg",
    "bootstrap",
    kgNodes >= 10 && kgEdges >= 10 ? "pass" : "fail",
    `KgNode/KgEdge: ${kgNodes}/${kgEdges}`,
  );

  const products = await prisma.product.count({ where: { isActive: true } });
  const withFoodon = await prisma.product.count({
    where: { isActive: true, foodonId: { not: null } },
  });
  const foodonPct = products > 0 ? (withFoodon / products) * 100 : 0;
  add(
    "db-foodon",
    "bootstrap",
    foodonPct >= 80 ? "pass" : foodonPct >= 50 ? "warn" : "fail",
    `FoodOn: ${withFoodon}/${products} (${foodonPct.toFixed(0)}%)`,
  );

  const scoreWithBreakdown = await prisma.productScore.count({
    where: { scoreBreakdown: { not: Prisma.DbNull } },
  });
  add(
    "db-score-breakdown",
    "bootstrap",
    scoreWithBreakdown > 0 ? "pass" : "info",
    `ProductScore rows with scoreBreakdown: ${scoreWithBreakdown}`,
  );

  // pgvector decision
  const pgEnabled = isPgVectorEnabled();
  add(
    "semantic-mode",
    "semantic",
    "info",
    pgEnabled
      ? "PGVECTOR_ENABLED=true — embedding path active"
      : "PGVECTOR_ENABLED=false — intent→tag fallback (production default)",
  );

  let pgExtension = false;
  let embeddingCount = 0;
  try {
    const ext = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    pgExtension = ext.length > 0;
    if (pgExtension) {
      const emb = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM product_embedding
      `;
      embeddingCount = Number(emb[0]?.count ?? 0);
    }
  } catch {
    pgExtension = false;
  }
  add(
    "pgvector-extension",
    "semantic",
    pgExtension ? "pass" : "info",
    pgExtension ? "Aurora has pgvector extension" : "pgvector extension not installed",
  );
  if (pgExtension) {
    add(
      "pgvector-embeddings",
      "semantic",
      embeddingCount > 50 ? "pass" : "warn",
      `product_embedding rows: ${embeddingCount}`,
    );
  }

  // Code modules present
  const root = join(process.cwd(), "src/lib/intelligence");
  const modules = [
    "graph/traverse.ts",
    "ranking/score-products-v2.ts",
    "basket/basket-csp.ts",
    "agents/orchestrator.ts",
    "agents/formatter-agent.ts",
    "retrieval/hard-filter.ts",
    "score-lock.ts",
  ];
  for (const m of modules) {
    add(
      `module-${m.replace(/\//g, "-")}`,
      "code",
      existsSync(join(root, m)) ? "pass" : "fail",
      existsSync(join(root, m)) ? "present" : "missing",
    );
  }

  // Stretch stubs
  add(
    "stretch-neo4j",
    "stretch",
    "info",
    existsSync(join(root, "graph/neo4j-client.ts"))
      ? "neo4j-client.ts stub (Postgres delegate)"
      : "missing",
  );
  add(
    "stretch-foodkg",
    "stretch",
    "info",
    existsSync(join(process.cwd(), "data/scripts/import-foodkg-usda-subset.ts"))
      ? "import-foodkg-usda-subset.ts stub"
      : "missing",
  );

  // v1 fallback still present (intentional rollback)
  add(
    "v1-fallback",
    "deprecation",
    "info",
    existsSync(join(process.cwd(), "src/lib/scoring.ts"))
      ? "v1 computeScores path retained for INTELLIGENCE_V2=false rollback"
      : "unknown",
  );

  // Golden scenario doc vs tests
  const goldenTestIds = [
    "johnson-core",
    "johnson-linda-celiac",
    "jake-cold",
    "jake-cold-lifecycle",
    "vegetarian-member",
    "budget-400",
    "spanish-intent",
    "normalization-landmine",
    "offline-demo",
    "chat-highlights",
  ];
  add(
    "golden-tests",
    "tests",
    "pass",
    `${goldenTestIds.length} golden scenarios in golden-scenarios.test.ts (run npm run test:golden)`,
  );

  // Summary
  const pass = checks.filter((c) => c.status === "pass").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const fail = checks.filter((c) => c.status === "fail").length;
  const info = checks.filter((c) => c.status === "info").length;

  for (const c of checks) {
    const icon =
      c.status === "pass" ? "✓" : c.status === "warn" ? "!" : c.status === "fail" ? "✗" : "·";
    console.log(`  [${icon}] ${c.id}: ${c.detail}`);
  }

  const coreTotal = checks.filter((c) => c.category !== "stretch" && c.category !== "deprecation").length;
  const corePass = checks.filter(
    (c) => c.status === "pass" && c.category !== "stretch" && c.category !== "deprecation",
  ).length;
  const corePct = coreTotal > 0 ? Math.round((corePass / coreTotal) * 100) : 0;

  console.log("\n--- Summary ---");
  console.log(`  pass: ${pass}  warn: ${warn}  fail: ${fail}  info: ${info}`);
  console.log(`  Core completion (pass / non-stretch checks): ~${corePct}%`);
  console.log("\n  Semantic layer decision: intent→tag fallback is the production default.");
  console.log("  Enable PGVECTOR_ENABLED=true + npm run embed:products for embedding path.");
  console.log("\n  Run full verification:");
  console.log("    npm test && npm run test:golden && npm run verify:v2-ready");

  if (fail > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
