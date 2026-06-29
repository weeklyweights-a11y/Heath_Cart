import type { HealthBadge, NutritionLookup, Product } from "@prisma/client";
import { prisma } from "./db";
import {
  buildActiveFamilyContext,
  type FamilyContextResult,
} from "./family-context";
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

function parseReasoningJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is string => typeof r === "string");
}

export async function invalidateFamilyScores(familyId: string): Promise<void> {
  await prisma.productScore.deleteMany({ where: { familyId } });
}

async function readCachedScores(
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
  }));
}

async function persistScores(
  familyId: string,
  results: ScoredProduct[],
): Promise<void> {
  await prisma.$transaction([
    prisma.productScore.deleteMany({ where: { familyId } }),
    prisma.productScore.createMany({
      data: results.map((r) => ({
        familyId,
        productId: r.productId,
        score: r.score,
        badge: r.badge,
        reasoning: r.reasoning,
      })),
    }),
  ]);
}

function computeScores(
  ctx: FamilyContextResult,
  rules: Awaited<ReturnType<typeof prisma.healthConditionRule.findMany>>,
  products: (Product & {
    tags: { tag: string }[];
    nutrition: NutritionLookup | null;
  })[],
): ScoredProduct[] {
  const members = ctx.activeMembers;
  const referenceMonth = ctx.referenceDate.getMonth() + 1;
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

    if (allMembersHealthy(members) && product.nutrition) {
      const densityBoost = nutritionalDensityScore(
        product.nutrition,
        product.isSeasonal,
        referenceMonth,
        product.availableMonths,
      );
      if (densityBoost > 0) {
        reasoning.push(
          "Nutrient-dense choice with fiber, protein, or vitamins for balanced weekly eating.",
        );
      }
      score += densityBoost;
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

  results.sort((a, b) => b.score - a.score);
  return results;
}

export async function scoreProductsForFamily(
  familyId: string,
  options?: { force?: boolean; ctx?: FamilyContextResult },
): Promise<ScoredProduct[]> {
  if (!options?.force) {
    const cached = await readCachedScores(familyId);
    if (cached) return cached;
  }

  const ctx = options?.ctx ?? (await buildActiveFamilyContext(familyId));

  const [rules, products] = await Promise.all([
    prisma.healthConditionRule.findMany({ where: { isActive: true } }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { tags: true, variants: true, nutrition: true },
    }),
  ]);

  const results = computeScores(ctx, rules, products);
  await persistScores(familyId, results);
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
