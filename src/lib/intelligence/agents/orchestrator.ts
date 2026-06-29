import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyExtractedContext } from "@/lib/context-applier";
import { getFamilyById } from "@/lib/family-service";
import { invalidateFamilyScores } from "@/lib/scoring";
import { getWeekStart, toDateOnly } from "@/lib/week";
import type { BasketResult, ExtractedContext, ScoredProduct } from "@/lib/types";
import { parseIntent } from "./intent-agent";
import { formatChatResponse, formatClarification } from "./formatter-agent";
import { generateBasketV2 } from "../basket/basket-csp";
import { scoreProductsV2 } from "../ranking/score-products-v2";
import { clearGraphTraversalCache } from "../graph/traverse";
import { isIntelligenceV2Enabled } from "../config";

export interface ChatOrchestratorResult {
  response: string;
  extractedContext: ExtractedContext;
  updatedScores: ScoredProduct[];
  basket: BasketResult;
  basketId: string;
  explanationTraces?: unknown;
}

export async function runChat(params: {
  familyId: string;
  message: string;
  budget?: number;
}): Promise<ChatOrchestratorResult> {
  if (!isIntelligenceV2Enabled()) {
    throw new Error("runChat requires INTELLIGENCE_V2=true");
  }

  const t0 = Date.now();
  const family = await getFamilyById(params.familyId);
  if (!family) throw new Error("Family not found");

  const weekStart = toDateOnly(getWeekStart());
  const existingWeekly = await prisma.weeklyContext.findUnique({
    where: { familyId_weekStart: { familyId: params.familyId, weekStart } },
  });

  const { extracted, refined } = await parseIntent(params.message, family.members);

  if (refined.confidence < 0.6) {
    const response = await formatClarification(params.message);
    return {
      response,
      extractedContext: extracted,
      updatedScores: [],
      basket: {
        basketId: "",
        items: [],
        coverageScore: 0,
        perMemberCoverage: {},
        totalPrice: 0,
        weeklyContext: "",
      },
      basketId: "",
    };
  }

  const applied = await applyExtractedContext(
    params.familyId,
    extracted,
    existingWeekly,
    params.message,
  );

  const contextJson = applied.mergedContext as unknown as Prisma.InputJsonValue;
  await prisma.weeklyContext.upsert({
    where: { familyId_weekStart: { familyId: params.familyId, weekStart } },
    create: {
      familyId: params.familyId,
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

  clearGraphTraversalCache(params.familyId);
  await invalidateFamilyScores(params.familyId);

  const updatedScores = await scoreProductsV2(params.familyId, { force: true });
  const budget =
    params.budget ?? applied.mergedContext.budgetUsd ?? extracted.budgetUsd;

  const basket = await generateBasketV2(params.familyId, {
    ...(budget != null ? { budget } : {}),
  });

  const nameIds = Array.from(
    new Set([
      ...updatedScores.slice(0, 20).map((s) => s.productId),
      ...basket.items.map((i) => i.productId),
    ]),
  );
  const nameRows = await prisma.product.findMany({
    where: { id: { in: nameIds } },
    select: { id: true, nameEn: true },
  });
  const productNames = new Map(nameRows.map((r) => [r.id, r.nameEn]));

  const response = await formatChatResponse(
    params.message,
    applied.mergedContext,
    updatedScores,
    basket,
    productNames,
    basket.items.map((i) => i.explanation),
  );

  const traceJson = {
    refined: JSON.parse(JSON.stringify(refined)),
    scoreCount: updatedScores.length,
    basketItemCount: basket.items.length,
    coverage: basket.coverageScore,
  } as Prisma.InputJsonValue;

  await prisma.intelligenceRun.create({
    data: {
      familyId: params.familyId,
      message: params.message,
      traceJson,
      durationMs: Date.now() - t0,
    },
  });

  return {
    response,
    extractedContext: applied.mergedContext,
    updatedScores,
    basket,
    basketId: basket.basketId,
    explanationTraces: basket.items.map((i) => i.explanation),
  };
}
