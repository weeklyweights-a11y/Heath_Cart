import type { HealthAction, HealthBadge } from "@prisma/client";
import { prisma } from "./db";
import { buildActiveFamilyContext } from "./family-context";
import { applyMoodBoost, getMoodBoosts } from "./mood-tags";
import {
  allMembersHealthy,
  nutritionalDensityScore,
} from "./nutritional-density";
import type { ScoredProduct } from "./types";

const BADGE_THRESHOLDS = {
  recommended: 20,
  neutral: 0,
  limit: -15,
} as const;

function assignBadge(
  score: number,
  hasAvoidMatch: boolean,
): HealthBadge {
  if (hasAvoidMatch) return "avoid";
  if (score >= BADGE_THRESHOLDS.recommended) return "recommended";
  if (score >= BADGE_THRESHOLDS.neutral) return "neutral";
  if (score >= BADGE_THRESHOLDS.limit) return "limit";
  return "avoid";
}

function formatReason(ruleReason: string, memberName: string): string {
  return `${ruleReason} — recommended for ${memberName}.`;
}

export async function scoreProductsForFamily(
  familyId: string,
): Promise<ScoredProduct[]> {
  const ctx = await buildActiveFamilyContext(familyId);
  const members = ctx.activeMembers;
  const referenceMonth = ctx.referenceDate.getMonth() + 1;

  const rules = await prisma.healthConditionRule.findMany({
    where: { isActive: true },
  });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      tags: true,
      variants: true,
      nutrition: true,
    },
  });

  const moodBoosts = getMoodBoosts(
    ctx.weeklyContext?.cuisineMood ?? ctx.extractedContext.mood?.overall,
    ctx.extractedContext.dietary_needs,
  );

  const results: ScoredProduct[] = [];

  for (const product of products) {
    const tagSet = new Set(product.tags.map((t) => t.tag));
    let score = 0;
    const reasoning: string[] = [];
    let hasAvoidMatch = false;

    if (members.length === 0) {
      results.push({
        productId: product.id,
        score: 0,
        badge: "neutral",
        reasoning: [],
      });
      continue;
    }

    for (const member of members) {
      for (const condition of member.effectiveConditions) {
        const matchingRules = rules.filter((r) => r.condition === condition);
        for (const rule of matchingRules) {
          if (!tagSet.has(rule.targetTag)) continue;
          score += rule.scoreImpact;
          if (rule.action === "avoid") {
            hasAvoidMatch = true;
          }
          reasoning.push(formatReason(rule.reason, member.name));
        }
      }
    }

    if (allMembersHealthy(members)) {
      score += nutritionalDensityScore(
        product.nutrition,
        product.isSeasonal,
        referenceMonth,
        product.availableMonths,
      );
    }

    if (moodBoosts.length > 0 && !hasAvoidMatch) {
      score += applyMoodBoost(tagSet, product.category, moodBoosts);
    }

    const badge = assignBadge(score, hasAvoidMatch);

    results.push({
      productId: product.id,
      score,
      badge,
      reasoning,
    });
  }

  if (allMembersHealthy(members)) {
    results.sort((a, b) => b.score - a.score);
  } else {
    results.sort((a, b) => b.score - a.score);
  }

  await prisma.$transaction(
    results.map((r) =>
      prisma.productScore.upsert({
        where: {
          familyId_productId: {
            familyId,
            productId: r.productId,
          },
        },
        create: {
          familyId,
          productId: r.productId,
          score: r.score,
          badge: r.badge,
          reasoning: r.reasoning,
        },
        update: {
          score: r.score,
          badge: r.badge,
          reasoning: r.reasoning,
          computedAt: new Date(),
        },
      }),
    ),
  );

  return results;
}

export async function getScoredProductDetails(
  familyId: string,
  category?: string,
): Promise<
  {
    id: string;
    nameEn: string;
    category: string;
    price: number;
    imageUrl: string | null;
    score: number;
    badge: HealthBadge;
    reasoning: string[];
  }[]
> {
  const scores = await scoreProductsForFamily(familyId);
  const scoreMap = new Map(scores.map((s) => [s.productId, s]));

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    include: { variants: true },
  });

  return products
    .map((p) => {
      const s = scoreMap.get(p.id);
      if (!s) return null;
      const cheapest = p.variants.reduce(
        (min, v) => (Number(v.price) < min ? Number(v.price) : min),
        Number(p.variants[0]?.price ?? 0),
      );
      return {
        id: p.id,
        nameEn: p.nameEn,
        category: p.category,
        price: cheapest,
        imageUrl: p.imageUrl,
        score: s.score,
        badge: s.badge,
        reasoning: s.reasoning,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.score - a.score);
}
