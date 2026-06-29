import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { extractContext, generateResponse } from "@/lib/ai";
import {
  applyExtractedContext,
} from "@/lib/context-applier";
import {
  badRequest,
  chatBodySchema,
  notFound,
  ok,
  serverError,
} from "@/lib/api-helpers";
import { getFamilyById } from "@/lib/family-service";
import { scoreProductsForFamily } from "@/lib/scoring";
import { generateBasket } from "@/lib/optimizer";
import { getWeekStart, toDateOnly } from "@/lib/week";

export async function POST(request: NextRequest) {
  try {
    const body = chatBodySchema.safeParse(await request.json());
    if (!body.success) return badRequest(body.error.message);

    const family = await getFamilyById(body.data.familyId);
    if (!family) return notFound("Family not found");

    const weekStart = toDateOnly(getWeekStart());
    const existingWeekly = await prisma.weeklyContext.findUnique({
      where: {
        familyId_weekStart: {
          familyId: body.data.familyId,
          weekStart,
        },
      },
    });

    const extracted = await extractContext(body.data.message, family.members);
    const applied = await applyExtractedContext(
      body.data.familyId,
      extracted,
      existingWeekly,
      body.data.message,
    );

    const contextJson = applied.mergedContext as unknown as Prisma.InputJsonValue;

    await prisma.weeklyContext.upsert({
      where: {
        familyId_weekStart: {
          familyId: body.data.familyId,
          weekStart,
        },
      },
      create: {
        familyId: body.data.familyId,
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

    const updatedScores = await scoreProductsForFamily(body.data.familyId);

    const budget =
      body.data.budget ??
      applied.mergedContext.budgetUsd ??
      extracted.budgetUsd;

    const basket = await generateBasket(body.data.familyId, {
      ...(budget != null ? { budget } : {}),
    });

    const response = await generateResponse(
      body.data.message,
      applied.mergedContext,
      updatedScores,
      basket,
    );

    return ok({
      response,
      extractedContext: applied.mergedContext,
      updatedScores,
      basket,
      basketId: basket.basketId,
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Chat failed");
  }
}
