import type { HealthBadge } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildActiveFamilyContext } from "@/lib/family-context";
import type { ScoredProduct } from "@/lib/types";
import { buildHouseholdState } from "../retrieval/household-state";
import { filterProducts } from "../retrieval/hard-filter";
import { assignBadgeFromQuartiles, computeHybridScore } from "./hybrid-score";
import { getSemanticScoresForProducts } from "../agents/semantic-retrieval";
import type { ProductWithNutrition } from "../types";
import { withFamilyScoreLock } from "../score-lock";

function parseReasoningJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is string => typeof r === "string");
}

export async function scoreProductsV2(
  familyId: string,
  options?: { force?: boolean },
): Promise<ScoredProduct[]> {
  void options?.force;

  const ctx = await buildActiveFamilyContext(familyId);
  const state = await buildHouseholdState(familyId);
  const referenceMonth = ctx.referenceDate.getMonth() + 1;

  const products = (await prisma.product.findMany({
    where: { isActive: true },
    include: { tags: true, variants: true, nutrition: true },
  })) as ProductWithNutrition[];

  const feasible = filterProducts(products, state);
  const semanticMap = await getSemanticScoresForProducts(state, products);
  const feasibleSet = new Set(feasible.map((p) => p.id));

  const scored = products.map((product) => {
    if (!feasibleSet.has(product.id)) {
      return {
        productId: product.id,
        score: 0,
        badge: "avoid" as HealthBadge,
        reasoning: ["Excluded by hard safety filter."],
        scoreBreakdown: {
          nutrient: 0,
          graph: 0,
          semantic: 0,
          seasonal: 0,
        },
        hasAvoid: true,
      };
    }

    const semantic = semanticMap.get(product.id) ?? 0;
    const { finalScore, breakdown } = computeHybridScore({
      product,
      state,
      semanticScore: semantic,
      referenceMonth,
    });

    const reasoning: string[] = [];
    for (const [tag, info] of Array.from(state.graphRetrieval.requiredTags.entries())) {
      if (product.tags.some((t) => t.tag === tag)) {
        reasoning.push(info.reason);
      }
    }
    if (breakdown.nutrient > 0.5) {
      reasoning.push("Strong nutrient alignment with household weekly targets.");
    }
    if (breakdown.seasonal > 0.8) {
      reasoning.push("In season this month.");
    }

    return {
      productId: product.id,
      score: finalScore * 100,
      badge: "neutral" as HealthBadge,
      reasoning,
      scoreBreakdown: breakdown,
      hasAvoid: false,
    };
  });

  const allScores = scored.map((s) => s.score);
  const results: ScoredProduct[] = scored.map((s) => ({
    productId: s.productId,
    score: s.score,
    badge: assignBadgeFromQuartiles(s.score, allScores, s.hasAvoid),
    reasoning: s.reasoning,
    scoreBreakdown: s.scoreBreakdown,
  }));

  results.sort((a, b) => b.score - a.score);

  await withFamilyScoreLock(familyId, () =>
    prisma.$transaction([
      prisma.productScore.deleteMany({ where: { familyId } }),
      prisma.productScore.createMany({
        data: results.map((r) => ({
          familyId,
          productId: r.productId,
          score: r.score,
          badge: r.badge as HealthBadge,
          reasoning: r.reasoning,
          scoreBreakdown: r.scoreBreakdown
            ? (JSON.parse(JSON.stringify(r.scoreBreakdown)) as Prisma.InputJsonValue)
            : undefined,
        })),
      }),
    ]),
  );

  return results;
}

export async function readCachedScoresV2(
  familyId: string,
): Promise<ScoredProduct[] | null> {
  const [rows, productCount] = await Promise.all([
    prisma.productScore.findMany({ where: { familyId } }),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  if (rows.length === 0 || rows.length < productCount) return null;

  return rows.map((r) => ({
    productId: r.productId,
    score: r.score,
    badge: r.badge,
    reasoning: parseReasoningJson(r.reasoning),
    scoreBreakdown: r.scoreBreakdown as unknown as ScoredProduct["scoreBreakdown"],
  }));
}
