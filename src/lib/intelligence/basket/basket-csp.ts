import { prisma } from "@/lib/db";
import { ITEMS_PER_CATEGORY } from "@/lib/basket-config";
import { enrichBasketItems } from "@/lib/basket-enrich";
import { buildActiveFamilyContext } from "@/lib/family-context";
import { calculateNutrientGaps } from "@/lib/nutrient-gaps";
import { calculateQuantity } from "@/lib/quantities";
import type { ActiveMember, BasketItem, BasketResult, ScoredProduct } from "@/lib/types";
import { weeklyTargetsForMember } from "@/lib/rda";
import { auditProductIds } from "../agents/safety-audit";
import { applyFairnessPass } from "./fairness";
import {
  buildItemExplanation,
  explanationToReasoning,
  membersBenefitingFromGraph,
} from "../explain/trace-path";
import { buildHouseholdState } from "../retrieval/household-state";
import { filterProducts, passesHardFilter } from "../retrieval/hard-filter";
import { scoreProductsV2 } from "../ranking/score-products-v2";
import type { HouseholdState, ProductWithNutrition, ScoreBreakdown } from "../types";

export interface BasketItemInternal extends BasketItem {
  priority: number;
  nutrients: {
    ironMg: number;
    fiberG: number;
    vitaminCMg: number;
    proteinG: number;
    calciumMg: number;
  };
}

const SEVERE = new Set(["diabetes", "celiac", "cholesterol", "anemia", "obesity"]);

export function computeMemberCoverage(
  member: ActiveMember,
  items: BasketItemInternal[],
): number {
  const targets = weeklyTargetsForMember(member.age, member.relation);
  const totals = { ironMg: 0, fiberG: 0, vitaminCMg: 0, proteinG: 0, calciumMg: 0 };
  for (const item of items) {
    totals.ironMg += item.nutrients.ironMg * item.quantity;
    totals.fiberG += item.nutrients.fiberG * item.quantity;
    totals.vitaminCMg += item.nutrients.vitaminCMg * item.quantity;
    totals.proteinG += item.nutrients.proteinG * item.quantity;
    totals.calciumMg += item.nutrients.calciumMg * item.quantity;
  }
  const pcts = [
    (totals.ironMg / targets.ironMg) * 100,
    (totals.fiberG / targets.fiberG) * 100,
    (totals.vitaminCMg / targets.vitaminCMg) * 100,
    (totals.proteinG / targets.proteinG) * 100,
    (totals.calciumMg / targets.calciumMg) * 100,
  ];
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
}

export function overallCoverage(members: ActiveMember[], items: BasketItemInternal[]) {
  const perMember: Record<string, number> = {};
  let weightedSum = 0;
  let weightTotal = 0;
  for (const m of members) {
    const cov = computeMemberCoverage(m, items);
    perMember[m.name] = Math.round(cov);
    const w = m.effectiveConditions.some((c) => SEVERE.has(c)) ? 1.5 : 1;
    weightedSum += cov * w;
    weightTotal += w;
  }
  return { overall: weightTotal > 0 ? weightedSum / weightTotal : 0, perMember };
}

function itemPriority(memberConditions: string[], score: number): number {
  if (memberConditions.some((c) => SEVERE.has(c))) return 100 + score;
  return score;
}

async function findProductByName(query: string) {
  return prisma.product.findFirst({
    where: { isActive: true, nameEn: { contains: query, mode: "insensitive" } },
    include: { variants: true, tags: true, nutrition: true },
  });
}

function toInternal(
  p: ProductWithNutrition,
  qty: { quantity: number; variantId: string; unitPrice: number },
  score: number,
  reasoning: string,
  membersBenefiting: string[],
  explanation?: BasketItem["explanation"],
): BasketItemInternal {
  const variant = p.variants.find((v) => v.id === qty.variantId)!;
  const n = p.nutrition;
  return {
    productId: p.id,
    name: p.nameEn,
    category: p.category,
    quantity: qty.quantity,
    variant: {
      variantId: variant.id,
      weightValue: variant.weightValue,
      weightUnit: variant.weightUnit,
    },
    price: qty.unitPrice * qty.quantity,
    reasoning,
    membersBenefiting,
    explanation,
    priority: score,
    nutrients: {
      ironMg: n?.ironMg ?? 0,
      fiberG: n?.fiberG ?? 0,
      vitaminCMg: n?.vitaminCMg ?? 0,
      proteinG: n?.proteinG ?? 0,
      calciumMg: n?.calciumMg ?? 0,
    },
  };
}

function buildExplanationForProduct(
  p: ProductWithNutrition,
  state: HouseholdState,
  members: ActiveMember[],
  score: ScoredProduct | undefined,
  variantLabel: string,
) {
  const tags = p.tags.map((t) => t.tag);
  const benefiting = membersBenefitingFromGraph(
    tags,
    members,
    state.graphRetrieval.requiredTags,
  );
  const breakdown = score?.scoreBreakdown as ScoreBreakdown | undefined;
  const { pass, reasons } = passesHardFilter(p, state);
  const explanation = buildItemExplanation({
    productName: p.nameEn,
    category: p.category,
    membersBenefiting: benefiting,
    scoreReasoning: score?.reasoning ?? [],
    scoreBreakdown: breakdown,
    graphPath: breakdown?.graphPaths?.[0],
    constraintsChecked: pass ? ["hard-filter: pass"] : reasons,
    headcount: members.length,
    variantLabel,
  });
  return { explanation, benefiting, reasoning: explanationToReasoning(explanation) };
}

function makeFairnessSwapCandidate(
  products: ProductWithNutrition[],
  scoreMap: Map<string, ScoredProduct>,
  state: HouseholdState,
  members: ActiveMember[],
  gaps: ReturnType<typeof calculateNutrientGaps>,
) {
  return (
    items: BasketItemInternal[],
    member: ActiveMember,
  ): BasketItemInternal | null => {
    const inBasket = new Set(items.map((i) => i.productId));
    const weakest = [...items].sort(
      (a, b) => computeMemberCoverage(member, [a]) - computeMemberCoverage(member, [b]),
    )[0];
    if (!weakest?.category) return null;

    const alternatives = products
      .filter(
        (p) =>
          p.category === weakest.category &&
          !inBasket.has(p.id) &&
          passesHardFilter(p, state).pass,
      )
      .map((p) => ({ p, score: scoreMap.get(p.id)?.score ?? 0 }))
      .sort((a, b) => b.score - a.score);

    for (const { p, score } of alternatives.slice(0, 5)) {
      const qty = calculateQuantity(p, p.variants, members, gaps);
      if (!qty) continue;
      const variant = p.variants.find((v) => v.id === qty.variantId)!;
      const bundle = buildExplanationForProduct(
        p,
        state,
        members,
        scoreMap.get(p.id),
        `${variant.weightValue} ${variant.weightUnit}`,
      );
      const candidate = toInternal(
        p,
        qty,
        itemPriority(member.effectiveConditions, score),
        bundle.reasoning,
        bundle.benefiting,
        bundle.explanation,
      );
      const withoutWeakest = items.filter((i) => i.productId !== weakest.productId);
      const newCov = computeMemberCoverage(member, [...withoutWeakest, candidate]);
      const oldCov = computeMemberCoverage(member, items);
      if (newCov > oldCov + 2) return candidate;
    }
    return null;
  };
}

export async function itemsToInternalV2(
  items: BasketItem[],
  familyId: string,
): Promise<BasketItemInternal[]> {
  const ctx = await buildActiveFamilyContext(familyId);
  const state = await buildHouseholdState(familyId);
  const scores = await scoreProductsV2(familyId);
  const scoreMap = new Map(scores.map((s) => [s.productId, s]));

  const enriched: BasketItemInternal[] = [];
  for (const item of items) {
    const product = (await prisma.product.findUnique({
      where: { id: item.productId },
      include: { variants: true, tags: true, nutrition: true },
    })) as ProductWithNutrition | null;
    if (!product) continue;

    const bundle = buildExplanationForProduct(
      product,
      state,
      ctx.activeMembers,
      scoreMap.get(item.productId),
      `${item.variant.weightValue} ${item.variant.weightUnit}`,
    );

    enriched.push({
      ...item,
      category: product.category,
      reasoning: bundle.reasoning,
      membersBenefiting: bundle.benefiting,
      explanation: bundle.explanation,
      priority: scoreMap.get(item.productId)?.score ?? 50,
      nutrients: {
        ironMg: product.nutrition?.ironMg ?? 0,
        fiberG: product.nutrition?.fiberG ?? 0,
        vitaminCMg: product.nutrition?.vitaminCMg ?? 0,
        proteinG: product.nutrition?.proteinG ?? 0,
        calciumMg: product.nutrition?.calciumMg ?? 0,
      },
    });
  }
  return enriched;
}

export async function auditAndStripBasket(
  items: BasketItemInternal[],
  familyId: string,
): Promise<BasketItemInternal[]> {
  const state = await buildHouseholdState(familyId);
  const products = (await prisma.product.findMany({
    where: { isActive: true, id: { in: items.map((i) => i.productId) } },
    include: { variants: true, tags: true, nutrition: true },
  })) as ProductWithNutrition[];

  let working = [...items];
  let audit = auditProductIds(products, state);
  let retries = 0;
  while (!audit.pass && retries < 2) {
    working = working.filter((item) => {
      const p = products.find((x) => x.id === item.productId);
      return p && passesHardFilter(p, state).pass;
    });
    const remaining = products.filter((p) => working.some((i) => i.productId === p.id));
    audit = auditProductIds(remaining, state);
    retries++;
  }
  return working;
}

export async function persistBasketResult(
  familyId: string,
  basketId: string,
  items: BasketItem[],
  weeklyContext: string,
): Promise<BasketResult> {
  const internal = await itemsToInternalV2(items, familyId);
  const audited = await auditAndStripBasket(internal, familyId);
  const ctx = await buildActiveFamilyContext(familyId);
  const cov = overallCoverage(ctx.activeMembers, audited);
  const totalPrice = audited.reduce((s, i) => s + i.price, 0);
  const stripped = audited.map(({ priority: _p, nutrients: _n, ...rest }) => rest);

  await prisma.basketRecommendation.update({
    where: { id: basketId },
    data: {
      basketJson: stripped as unknown as import("@prisma/client").Prisma.InputJsonValue,
      coverageScore: cov.overall,
      totalPrice,
    },
  });

  return {
    basketId,
    items: await enrichBasketItems(stripped),
    coverageScore: Math.round(cov.overall),
    perMemberCoverage: cov.perMember,
    totalPrice,
    weeklyContext,
  };
}

export async function assertProductAllowedV2(
  familyId: string,
  productId: string,
): Promise<void> {
  const state = await buildHouseholdState(familyId);
  const product = (await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true, tags: true, nutrition: true },
  })) as ProductWithNutrition | null;
  if (!product) throw new Error("Product not found");
  const { pass, reasons } = passesHardFilter(product, state);
  if (!pass) throw new Error(`Cannot add ${product.nameEn}: ${reasons.join("; ")}`);
}

export async function generateBasketV2(
  familyId: string,
  options?: { budget?: number },
): Promise<BasketResult> {
  const ctx = await buildActiveFamilyContext(familyId);
  const members = ctx.activeMembers;
  const gaps = calculateNutrientGaps(members);
  const state = await buildHouseholdState(familyId);
  const scores = await scoreProductsV2(familyId, { force: true });
  const scoreMap = new Map(scores.map((s) => [s.productId, s]));

  const products = (await prisma.product.findMany({
    where: { isActive: true },
    include: { variants: true, tags: true, nutrition: true },
  })) as ProductWithNutrition[];

  const feasible = filterProducts(products, state);
  const feasibleIds = new Set(feasible.map((p) => p.id));

  const byCategory = new Map<string, ProductWithNutrition[]>();
  for (const p of feasible) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }

  const items: BasketItemInternal[] = [];

  for (const [category, limit] of Object.entries(ITEMS_PER_CATEGORY)) {
    const catProducts = (byCategory.get(category) ?? [])
      .map((p) => ({ p, score: scoreMap.get(p.id)?.score ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    for (const { p, score } of catProducts) {
      const qty = calculateQuantity(p, p.variants, members, gaps);
      if (!qty) continue;
      const variant = p.variants.find((v) => v.id === qty.variantId)!;
      const bundle = buildExplanationForProduct(
        p,
        state,
        members,
        scoreMap.get(p.id),
        `${variant.weightValue} ${variant.weightUnit}`,
      );

      items.push(
        toInternal(
          p,
          qty,
          itemPriority(members.flatMap((m) => m.effectiveConditions), score),
          bundle.reasoning,
          bundle.benefiting,
          bundle.explanation,
        ),
      );
    }
  }

  for (const need of ctx.extractedContext.practical_needs) {
    const product = await findProductByName(need.item);
    if (!product || !feasibleIds.has(product.id) || items.some((i) => i.productId === product.id))
      continue;
    const qty = calculateQuantity(product, product.variants, members, gaps);
    if (!qty) continue;
    items.push(
      toInternal(
        product as ProductWithNutrition,
        qty,
        50,
        `Included for practical need: ${need.item}.`,
        [],
      ),
    );
  }

  let working = applyFairnessPass(
    items,
    members,
    computeMemberCoverage,
    makeFairnessSwapCandidate(products, scoreMap, state, members, gaps),
  );

  let coverageTradeoff: string | undefined;
  let totalPrice = working.reduce((s, i) => s + i.price, 0);

  if (options?.budget && totalPrice > options.budget) {
    coverageTradeoff = `Reduced basket to stay under $${options.budget.toFixed(2)}. `;
    let sorted = [...working].sort((a, b) => a.priority - b.priority);
    while (totalPrice > options.budget && sorted.length > 0) {
      const drop = sorted.shift()!;
      const dropIdx = working.findIndex((i) => i.productId === drop.productId);
      if (dropIdx < 0) continue;
      coverageTradeoff += `Removed ${working[dropIdx].name}. `;
      working.splice(dropIdx, 1);
      sorted = [...working].sort((a, b) => a.priority - b.priority);
      totalPrice = working.reduce((s, i) => s + i.price, 0);
    }
  }

  working = await auditAndStripBasket(working, familyId);

  const cov = overallCoverage(members, working);
  const weeklySummary = [
    ctx.weeklyContext?.cuisineMood,
    ctx.extractedContext.dietary_needs.map((d) => d.requirement).join(", "),
  ]
    .filter(Boolean)
    .join("; ");

  const stripped = working.map(({ priority: _p, nutrients: _n, ...rest }) => rest);

  const basketRecord = await prisma.basketRecommendation.create({
    data: {
      familyId,
      basketJson: stripped as unknown as import("@prisma/client").Prisma.InputJsonValue,
      coverageScore: cov.overall,
      totalPrice,
      context: weeklySummary || null,
    },
  });

  return {
    basketId: basketRecord.id,
    items: await enrichBasketItems(stripped),
    coverageScore: Math.round(cov.overall),
    perMemberCoverage: cov.perMember,
    totalPrice,
    weeklyContext: weeklySummary,
    coverageTradeoff,
  };
}
