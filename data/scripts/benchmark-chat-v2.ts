/**
 * Compare v1 vs v2 benchmark metrics side-by-side.
 * Usage: npm run benchmark:chat:v2 -- --direct
 */
import "./load-env";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { performance } from "node:perf_hooks";
import { prisma } from "./prisma-client";
import { seedJohnson } from "../../src/lib/seed-johnson";
import { scoreProductsForFamily } from "../../src/lib/scoring";
import { generateBasket } from "../../src/lib/optimizer";

const MESSAGE = "Jake has a cold — need something light for the week.";

async function runMode(v2: boolean) {
  process.env.INTELLIGENCE_V2 = v2 ? "true" : "false";
  const family = await seedJohnson(false);
  const t0 = performance.now();
  const scores = await scoreProductsForFamily(family.id, { force: true });
  const scoreMs = performance.now() - t0;
  const t1 = performance.now();
  const basket = await generateBasket(family.id);
  const basketMs = performance.now() - t1;
  return {
    mode: v2 ? "v2" : "v1",
    scoreMs: Math.round(scoreMs),
    basketMs: Math.round(basketMs),
    totalMs: Math.round(scoreMs + basketMs),
    itemCount: basket.items.length,
    coverage: basket.coverageScore,
    totalPrice: basket.totalPrice,
    topScore: scores[0]?.score ?? 0,
  };
}

async function main(): Promise<void> {
  const v1 = await runMode(false);
  const v2 = await runMode(true);
  const report = { generatedAt: new Date().toISOString(), message: MESSAGE, v1, v2 };
  console.log(JSON.stringify(report, null, 2));
  const out = resolve(process.cwd(), "benchmark-chat-v2-report.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
