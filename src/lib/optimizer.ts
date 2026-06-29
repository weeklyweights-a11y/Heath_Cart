import { prisma } from "./db";
import { buildActiveFamilyContext } from "./family-context";
import { calculateNutrientGaps, memberSeverityWeight } from "./nutrient-gaps";
import { calculateQuantity } from "./quantities";
import { scoreProductsForFamily } from "./scoring";
import {
  CRITICAL_NUTRIENT_THRESHOLD,
  ITEMS_PER_CATEGORY,
  SEVERITY_CONDITIONS,
} from "./basket-config";
import { enrichBasketItems } from "./basket-enrich";
import { formatBasketItemWhy } from "./member-labels";
import type { ActiveMember, BasketItem, BasketResult } from "./types";
import { weeklyTargetsForMember } from "./rda";
import { isIntelligenceV2Enabled } from "./intelligence/config";
import {
  assertProductAllowedV2,
  generateBasketV2,
  persistBasketResult,
} from "./intelligence/basket/basket-csp";
import { buildHouseholdState } from "./intelligence/retrieval/household-state";
import {
  buildItemExplanation,
  explanationToReasoning,
  membersBenefitingFromGraph,
} from "./intelligence/explain/trace-path";

interface BasketItemInternal extends BasketItem {
  priority: number;
  nutrients: {
    ironMg: number;
    fiberG: number;
    vitaminCMg: number;
    proteinG: number;
    calciumMg: number;
  };
}

function computeMemberCoverage(
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

function overallCoverage(
  members: ActiveMember[],
  items: BasketItemInternal[],
): { overall: number; perMember: Record<string, number> } {
  const perMember: Record<string, number> = {};
  let weightedSum = 0;
  let weightTotal = 0;

  for (const m of members) {
    const cov = computeMemberCoverage(m, items);
    perMember[m.name] = Math.round(cov);
    const w = memberSeverityWeight(m.effectiveConditions);
    weightedSum += cov * w;
    weightTotal += w;
  }

  return {
    overall: weightTotal > 0 ? weightedSum / weightTotal : 0,
    perMember,
  };
}

function itemPriority(memberConditions: string[], score: number): number {
  const healthCritical = memberConditions.some((c) =>
    SEVERITY_CONDITIONS.has(c),
  );
  if (healthCritical) return 100 + score;
  return score;
}

function membersBenefiting(
  productTags: string[],
  members: ActiveMember[],
  rules: { condition: string; targetTag: string }[],
): string[] {
  const names: string[] = [];
  for (const m of members) {
    for (const cond of m.effectiveConditions) {
      const match = rules.some(
        (r) => r.condition === cond && productTags.includes(r.targetTag),
      );
      if (match && !names.includes(m.name)) names.push(m.name);
    }
  }
  return names;
}

async function findProductByName(query: string) {
  return prisma.product.findFirst({
    where: {
      isActive: true,
      nameEn: { contains: query, mode: "insensitive" },
    },
    include: { variants: true, tags: true, nutrition: true },
  });
}

export async function generateBasket(
  familyId: string,
  options?: { budget?: number },
): Promise<BasketResult> {
  if (isIntelligenceV2Enabled()) {
    return generateBasketV2(familyId, options);
  }

  const ctx = await buildActiveFamilyContext(familyId);
  const members = ctx.activeMembers;
  const gaps = calculateNutrientGaps(members);
  const scores = await scoreProductsForFamily(familyId, { ctx });
  const scoreMap = new Map(scores.map((s) => [s.productId, s]));

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { variants: true, tags: true, nutrition: true },
  });

  const rules = await prisma.healthConditionRule.findMany({
    where: { isActive: true },
  });

  const byCategory = new Map<string, typeof products>();
  for (const p of products) {
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
      const n = p.nutrition;
      const tags = p.tags.map((t) => t.tag);
      const benefiting = membersBenefiting(tags, members, rules);
      const maxCondScore = Math.max(
        ...members.flatMap((m) =>
          m.effectiveConditions.map((c) =>
            itemPriority([c], score),
          ),
        ),
        score,
      );

      items.push({
        productId: p.id,
        name: p.nameEn,
        quantity: qty.quantity,
        variant: {
          variantId: variant.id,
          weightValue: variant.weightValue,
          weightUnit: variant.weightUnit,
        },
        price: qty.unitPrice * qty.quantity,
        reasoning: formatBasketItemWhy({
          category: p.category,
          membersBenefiting: benefiting,
          scoreReasoning: scoreMap.get(p.id)?.reasoning ?? [],
          headcount: members.length,
          variantLabel: `${variant.weightValue} ${variant.weightUnit}`,
        }),
        membersBenefiting: benefiting,
        priority: maxCondScore,
        nutrients: {
          ironMg: n?.ironMg ?? 0,
          fiberG: n?.fiberG ?? 0,
          vitaminCMg: n?.vitaminCMg ?? 0,
          proteinG: n?.proteinG ?? 0,
          calciumMg: n?.calciumMg ?? 0,
        },
      });
    }
  }

  for (const need of ctx.extractedContext.practical_needs) {
    const product = await findProductByName(need.item);
    if (!product || items.some((i) => i.productId === product.id)) continue;
    const qty = calculateQuantity(product, product.variants, members, gaps);
    if (!qty) continue;
    const variant = product.variants.find((v) => v.id === qty.variantId)!;
    items.push({
      productId: product.id,
      name: product.nameEn,
      quantity: qty.quantity,
      variant: {
        variantId: variant.id,
        weightValue: variant.weightValue,
        weightUnit: variant.weightUnit,
      },
      price: qty.unitPrice * qty.quantity,
      reasoning: `Included for practical need: ${need.item}.`,
      membersBenefiting: [],
      priority: 50,
      nutrients: {
        ironMg: product.nutrition?.ironMg ?? 0,
        fiberG: product.nutrition?.fiberG ?? 0,
        vitaminCMg: product.nutrition?.vitaminCMg ?? 0,
        proteinG: product.nutrition?.proteinG ?? 0,
        calciumMg: product.nutrition?.calciumMg ?? 0,
      },
    });
  }

  let coverageTradeoff: string | undefined;
  let working = [...items];
  let totalPrice = working.reduce((s, i) => s + i.price, 0);

  if (options?.budget && totalPrice > options.budget) {
    coverageTradeoff = `Reduced basket to stay under $${options.budget.toFixed(2)}. `;
    let sorted = [...working].sort((a, b) => a.priority - b.priority);

    while (totalPrice > options.budget && sorted.length > 0) {
      const drop = sorted.shift()!;
      const dropIdx = working.findIndex((i) => i.productId === drop.productId);
      if (dropIdx < 0) continue;

      if (working[dropIdx].priority >= 100 && working[dropIdx].quantity > 1) {
        const unit = working[dropIdx].price / working[dropIdx].quantity;
        working[dropIdx].quantity -= 1;
        working[dropIdx].price = unit * working[dropIdx].quantity;
        coverageTradeoff += `Reduced ${working[dropIdx].name}. `;
        sorted = [...working].sort((a, b) => a.priority - b.priority);
      } else {
        coverageTradeoff += `Removed ${working[dropIdx].name}. `;
        working.splice(dropIdx, 1);
        sorted = [...working].sort((a, b) => a.priority - b.priority);
      }
      totalPrice = working.reduce((s, i) => s + i.price, 0);
    }

    if (totalPrice > options.budget) {
      working = working.slice(0, Math.max(1, Math.floor(working.length / 3)));
      totalPrice = working.reduce((s, i) => s + i.price, 0);
      coverageTradeoff += "Kept only highest-priority essentials. ";
    }
  }

  const finalItems = working;
  const cov = overallCoverage(members, finalItems);

  const weeklySummary = [
    ctx.weeklyContext?.cuisineMood,
    ctx.extractedContext.dietary_needs.map((d) => d.requirement).join(", "),
  ]
    .filter(Boolean)
    .join("; ");

  const stripped = finalItems.map(({ priority: _p, nutrients: _n, ...rest }) => rest);

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

export async function adjustBasket(
  familyId: string,
  basketId: string,
  adjustments: { productId: string; newQuantity: number | "remove" }[],
): Promise<BasketResult> {
  const record = await prisma.basketRecommendation.findFirst({
    where: { id: basketId, familyId },
  });
  if (!record) throw new Error("Basket not found");

  let items = record.basketJson as unknown as BasketItem[];
  for (const adj of adjustments) {
    if (adj.newQuantity === "remove") {
      items = items.filter((i) => i.productId !== adj.productId);
    } else {
      const qty = adj.newQuantity;
      items = items.map((i) =>
        i.productId === adj.productId
          ? {
              ...i,
              quantity: qty,
              price: (i.price / i.quantity) * qty,
            }
          : i,
      );
    }
  }

  if (isIntelligenceV2Enabled()) {
    return persistBasketResult(familyId, basketId, items, record.context ?? "");
  }

  const ctx = await buildActiveFamilyContext(familyId);
  const members = ctx.activeMembers;

  const enriched: BasketItemInternal[] = [];
  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: { nutrition: true },
    });
    enriched.push({
      ...item,
      priority: 50,
      nutrients: {
        ironMg: product?.nutrition?.ironMg ?? 0,
        fiberG: product?.nutrition?.fiberG ?? 0,
        vitaminCMg: product?.nutrition?.vitaminCMg ?? 0,
        proteinG: product?.nutrition?.proteinG ?? 0,
        calciumMg: product?.nutrition?.calciumMg ?? 0,
      },
    });
  }

  const cov = overallCoverage(members, enriched);
  const totalPrice = items.reduce((s, i) => s + i.price, 0);

  await prisma.basketRecommendation.update({
    where: { id: basketId },
    data: {
      basketJson: items as unknown as import("@prisma/client").Prisma.InputJsonValue,
      coverageScore: cov.overall,
      totalPrice,
    },
  });

  return {
    basketId,
    items: await enrichBasketItems(items),
    coverageScore: Math.round(cov.overall),
    perMemberCoverage: cov.perMember,
    totalPrice,
    weeklyContext: record.context ?? "",
  };
}

async function itemsToInternal(
  items: BasketItem[],
  members: ActiveMember[],
): Promise<BasketItemInternal[]> {
  const enriched: BasketItemInternal[] = [];
  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: { nutrition: true },
    });
    enriched.push({
      ...item,
      priority: 50,
      nutrients: {
        ironMg: product?.nutrition?.ironMg ?? 0,
        fiberG: product?.nutrition?.fiberG ?? 0,
        vitaminCMg: product?.nutrition?.vitaminCMg ?? 0,
        proteinG: product?.nutrition?.proteinG ?? 0,
        calciumMg: product?.nutrition?.calciumMg ?? 0,
      },
    });
  }
  return enriched;
}

export async function getBasketById(basketId: string): Promise<BasketResult> {
  const record = await prisma.basketRecommendation.findUnique({
    where: { id: basketId },
  });
  if (!record) throw new Error("Basket not found");

  const items = record.basketJson as unknown as BasketItem[];

  if (isIntelligenceV2Enabled()) {
    return persistBasketResult(
      record.familyId,
      basketId,
      items,
      record.context ?? "",
    );
  }

  const ctx = await buildActiveFamilyContext(record.familyId);
  const enriched = await itemsToInternal(items, ctx.activeMembers);
  const cov = overallCoverage(ctx.activeMembers, enriched);
  const totalPrice = items.reduce((s, i) => s + i.price, 0);

  return {
    basketId: record.id,
    items: await enrichBasketItems(items),
    coverageScore: Math.round(cov.overall),
    perMemberCoverage: cov.perMember,
    totalPrice,
    weeklyContext: record.context ?? "",
  };
}

export async function addItemToBasket(
  familyId: string,
  productId: string,
  variantId: string,
  quantity: number,
  basketId?: string,
): Promise<BasketResult> {
  let targetId = basketId;
  if (!targetId) {
    const generated = await generateBasket(familyId);
    targetId = generated.basketId;
  }

  const record = await prisma.basketRecommendation.findFirst({
    where: { id: targetId, familyId },
  });
  if (!record) throw new Error("Basket not found");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true, tags: true, nutrition: true },
  });
  if (!product) throw new Error("Product not found");
  const variant = product.variants.find((v) => v.id === variantId);
  if (!variant) throw new Error("Variant not found");

  if (isIntelligenceV2Enabled()) {
    await assertProductAllowedV2(familyId, productId);
  }

  let items = record.basketJson as unknown as BasketItem[];
  const unitPrice = Number(variant.price);
  const existing = items.find((i) => i.productId === productId);
  const ctx = await buildActiveFamilyContext(familyId);

  if (existing) {
    const prevQty = existing.quantity;
    existing.quantity += quantity;
    const unit = existing.price / prevQty;
    if (existing.variant.variantId !== variantId) {
      existing.variant = {
        variantId: variant.id,
        weightValue: variant.weightValue,
        weightUnit: variant.weightUnit,
      };
      existing.price = unitPrice * existing.quantity;
    } else {
      existing.price = unit * existing.quantity;
    }
  } else {
    const scores = await scoreProductsForFamily(familyId);
    const scoreMap = new Map(scores.map((s) => [s.productId, s]));
    const tags = product.tags.map((t) => t.tag);
    let benefiting: string[];
    let reasoning: string;
    let explanation: BasketItem["explanation"] | undefined;

    if (isIntelligenceV2Enabled()) {
      const state = await buildHouseholdState(familyId);
      benefiting = membersBenefitingFromGraph(
        tags,
        ctx.activeMembers,
        state.graphRetrieval.requiredTags,
      );
      const score = scoreMap.get(productId);
      explanation = buildItemExplanation({
        productName: product.nameEn,
        category: product.category,
        membersBenefiting: benefiting,
        scoreReasoning: score?.reasoning ?? [],
        scoreBreakdown: score?.scoreBreakdown,
        graphPath: score?.scoreBreakdown?.graphPaths?.[0],
        constraintsChecked: ["hard-filter: pass"],
        headcount: ctx.activeMembers.length,
        variantLabel: `${variant.weightValue} ${variant.weightUnit}`,
      });
      reasoning = explanationToReasoning(explanation);
    } else {
      const rules = await prisma.healthConditionRule.findMany();
      benefiting = membersBenefiting(tags, ctx.activeMembers, rules);
      const score = scoreMap.get(productId);
      reasoning = formatBasketItemWhy({
        category: product.category,
        membersBenefiting: benefiting,
        scoreReasoning: score?.reasoning ?? [],
        headcount: ctx.activeMembers.length,
        variantLabel: `${variant.weightValue} ${variant.weightUnit}`,
      });
    }

    items.push({
      productId,
      name: product.nameEn,
      quantity,
      variant: {
        variantId: variant.id,
        weightValue: variant.weightValue,
        weightUnit: variant.weightUnit,
      },
      price: unitPrice * quantity,
      reasoning,
      membersBenefiting: benefiting,
      ...(explanation ? { explanation } : {}),
    });
  }

  if (isIntelligenceV2Enabled()) {
    return persistBasketResult(familyId, targetId, items, record.context ?? "");
  }

  const enriched = await itemsToInternal(items, ctx.activeMembers);
  const cov = overallCoverage(ctx.activeMembers, enriched);
  const totalPrice = items.reduce((s, i) => s + i.price, 0);

  await prisma.basketRecommendation.update({
    where: { id: targetId },
    data: {
      basketJson: items as unknown as import("@prisma/client").Prisma.InputJsonValue,
      coverageScore: cov.overall,
      totalPrice,
    },
  });

  return {
    basketId: targetId,
    items: await enrichBasketItems(items),
    coverageScore: Math.round(cov.overall),
    perMemberCoverage: cov.perMember,
    totalPrice,
    weeklyContext: record.context ?? "",
  };
}

export { CRITICAL_NUTRIENT_THRESHOLD };
