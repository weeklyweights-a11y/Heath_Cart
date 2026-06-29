import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../../__tests__/setup";
import { prisma } from "@/lib/db";
import { seedJohnson } from "@/lib/seed-johnson";
import { runChat } from "../agents/orchestrator";
import { isIntelligenceV2Enabled } from "../config";

describe.sequential("orchestrator (v2)", () => {
  let familyId: string;
  let savedGemini: string | undefined;
  let savedGoogle: string | undefined;

  beforeAll(async () => {
    process.env.VITEST_V2_SUITE = "1";
    process.env.INTELLIGENCE_V2 = "true";
    savedGemini = process.env.GEMINI_API_KEY;
    savedGoogle = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    expect(isIntelligenceV2Enabled()).toBe(true);

    const family = await seedJohnson(false);
    familyId = family.id;
    const kgCount = await prisma.kgNode.count();
    if (kgCount === 0) throw new Error("Run npm run seed:kg first");
  });

  afterAll(() => {
    process.env.INTELLIGENCE_V2 = "false";
    delete process.env.VITEST_V2_SUITE;
    if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
    else delete process.env.GEMINI_API_KEY;
    if (savedGoogle) process.env.GOOGLE_API_KEY = savedGoogle;
    else delete process.env.GOOGLE_API_KEY;
  });

  it("runChat returns basket, scores with breakdown, and explanation traces", async () => {
    const result = await runChat({
      familyId,
      message: "Jake has a cold — need something light and hydrating",
    });

    expect(result.response.length).toBeGreaterThan(10);
    expect(result.basket.items.length).toBeGreaterThan(3);
    expect(result.basketId).toBeTruthy();
    expect(result.updatedScores.length).toBeGreaterThan(50);

    const withBreakdown = result.updatedScores.find((s) => s.scoreBreakdown?.nutrient != null);
    expect(withBreakdown).toBeDefined();

    expect(Array.isArray(result.explanationTraces)).toBe(true);
    const traces = result.explanationTraces as { why?: string }[];
    expect(traces.some((t) => t?.why)).toBe(true);

    expect(result.extractedContext.health_states.some((h) => h.member === "Jake")).toBe(true);
  });

  it("logs IntelligenceRun with trace structure", async () => {
    const before = await prisma.intelligenceRun.count({ where: { familyId } });
    await runChat({ familyId, message: "We're having BBQ this weekend" });
    const after = await prisma.intelligenceRun.count({ where: { familyId } });
    expect(after).toBeGreaterThan(before);

    const run = await prisma.intelligenceRun.findFirst({
      where: { familyId },
      orderBy: { createdAt: "desc" },
    });
    const trace = run?.traceJson as { scoreCount?: number; basketItemCount?: number } | null;
    expect(trace?.scoreCount).toBeGreaterThan(0);
    expect(trace?.basketItemCount).toBeGreaterThan(0);
  });
});
