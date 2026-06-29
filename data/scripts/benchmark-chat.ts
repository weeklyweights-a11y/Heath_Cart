/**
 * Measure grocery assistant (/api/chat) latency — end-to-end and per-step.
 *
 * Usage:
 *   npm run benchmark:chat              # HTTP e2e against localhost:3000
 *   npm run benchmark:chat -- --direct  # in-process step breakdown (no server)
 */
import "./load-env";
import { performance } from "node:perf_hooks";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma-client";
import { seedJohnson } from "../../src/lib/seed-johnson";
import { getFamilyById } from "../../src/lib/family-service";
import { extractContext, generateResponse } from "../../src/lib/ai";
import { applyExtractedContext } from "../../src/lib/context-applier";
import { scoreProductsForFamily } from "../../src/lib/scoring";
import { generateBasket } from "../../src/lib/optimizer";
import { getWeekStart, toDateOnly } from "../../src/lib/week";

const BASE_URL = process.env.BENCHMARK_BASE_URL ?? "http://localhost:3000";

const SAMPLE_MESSAGES = [
  "My mom Linda is visiting from Florida and she can't eat gluten.",
  "Jake has a cold — need something light for the week.",
  "Saturday BBQ — what should I grab? Keep it under $120.",
];

function ms(start: number, end: number): number {
  return Math.round(end - start);
}

function fmt(msVal: number): string {
  return `${(msVal / 1000).toFixed(2)}s`;
}

async function getJohnsonFamilyId(): Promise<string> {
  const family = await seedJohnson(false);
  return family.id;
}

async function benchmarkHttp(familyId: string, message: string): Promise<number> {
  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ familyId, message }),
  });
  const t1 = performance.now();

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  await res.json();
  return ms(t0, t1);
}

async function benchmarkDirect(familyId: string, message: string) {
  const steps: Record<string, number> = {};
  let t = performance.now();

  const family = await getFamilyById(familyId);
  if (!family) throw new Error("Family not found");
  steps.loadFamily = ms(t, (t = performance.now()));

  const weekStart = toDateOnly(getWeekStart());
  const existingWeekly = await prisma.weeklyContext.findUnique({
    where: { familyId_weekStart: { familyId, weekStart } },
  });
  steps.loadWeeklyContext = ms(t, (t = performance.now()));

  const extracted = await extractContext(message, family.members);
  steps.extractContextGemini = ms(t, (t = performance.now()));

  const applied = await applyExtractedContext(
    familyId,
    extracted,
    existingWeekly,
    message,
  );
  steps.applyContext = ms(t, (t = performance.now()));

  const contextJson = applied.mergedContext as unknown as Prisma.InputJsonValue;
  await prisma.weeklyContext.upsert({
    where: { familyId_weekStart: { familyId, weekStart } },
    create: {
      familyId,
      weekStart,
      rawMessage: applied.rawMessage,
      extractedContext: contextJson,
      cuisineMood: applied.cuisineMood,
    },
    update: {
      rawMessage: applied.rawMessage,
      extractedContext: contextJson,
      cuisineMood: applied.cuisineMood,
    },
  });
  steps.saveWeeklyContext = ms(t, (t = performance.now()));

  const updatedScores = await scoreProductsForFamily(familyId);
  steps.scoreProducts = ms(t, (t = performance.now()));

  const budget =
    applied.mergedContext.budgetUsd ?? extracted.budgetUsd ?? undefined;
  const basket = await generateBasket(familyId, {
    ...(budget != null ? { budget } : {}),
  });
  steps.generateBasket = ms(t, (t = performance.now()));

  await generateResponse(message, applied.mergedContext, updatedScores, basket);
  steps.generateResponseGemini = ms(t, (t = performance.now()));

  steps.total = Object.entries(steps)
    .filter(([k]) => k !== "total")
    .reduce((sum, [, v]) => sum + v, 0);

  return steps;
}

async function main(): Promise<void> {
  const direct = process.argv.includes("--direct");
  console.log(`Grocery assistant benchmark (${direct ? "in-process" : "HTTP e2e"})\n`);

  const familyId = await getJohnsonFamilyId();
  console.log(`Family: Johnson (${familyId})\n`);

  if (direct) {
    for (const message of SAMPLE_MESSAGES) {
      console.log(`Message: "${message.slice(0, 60)}${message.length > 60 ? "…" : ""}"`);
      const steps = await benchmarkDirect(familyId, message);
      console.log(`  Total: ${fmt(steps.total)}`);
      for (const [key, val] of Object.entries(steps)) {
        if (key === "total") continue;
        const pct = ((val / steps.total) * 100).toFixed(0);
        console.log(`    ${key.padEnd(24)} ${fmt(val).padStart(7)}  (${pct}%)`);
      }
      console.log();
    }
    return;
  }

  const times: number[] = [];
  for (const message of SAMPLE_MESSAGES) {
    process.stdout.write(`  "${message.slice(0, 50)}…" `);
    try {
      const elapsed = await benchmarkHttp(familyId, message);
      times.push(elapsed);
      console.log(fmt(elapsed));
    } catch (e) {
      console.log("FAILED");
      console.error(`    ${e instanceof Error ? e.message : e}`);
    }
  }

  if (times.length) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    console.log(`\nSummary (${times.length} runs):`);
    console.log(`  Average: ${fmt(avg)}`);
    console.log(`  Min:     ${fmt(min)}`);
    console.log(`  Max:     ${fmt(max)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
