import type {
  BasketResult,
  ChatProductHighlight,
  ExtractedContext,
  FamilyMemberDto,
  ProductDto,
  ScoredProduct,
} from "./types";

const CONDITION_LABELS: Record<string, string> = {
  diabetes: "pre-diabetic",
  cholesterol: "cholesterol",
  obesity: "weight management",
  celiac: "celiac",
  anemia: "anemia",
  thyroid: "thyroid",
  hypertension: "hypertension",
  peanut_allergy: "peanut allergy",
  lactose_intolerance: "lactose intolerance",
};

function formatCondition(c: string): string {
  return CONDITION_LABELS[c] ?? c.replace(/_/g, " ");
}

export function memberConditionLabels(
  member: FamilyMemberDto,
  extractedContext: ExtractedContext,
): string[] {
  const labels = new Set<string>();
  for (const c of member.conditions) {
    labels.add(formatCondition(c));
  }
  for (const a of member.allergies) {
    if (a.toLowerCase().includes("peanut")) labels.add("peanut allergy");
    else labels.add(a);
  }
  for (const hs of extractedContext.health_states) {
    if (hs.member.toLowerCase() === member.name.toLowerCase() && !hs.remove) {
      labels.add(formatCondition(hs.condition));
    }
  }
  return Array.from(labels);
}

export function formatMemberCoverageLabel(
  member: FamilyMemberDto,
  pct: number,
  extractedContext: ExtractedContext,
): string {
  const conds = memberConditionLabels(member, extractedContext);
  const suffix = conds.length ? ` (${conds.join(", ")})` : "";
  return `${member.name}${suffix}: ${pct}%`;
}

export function formatBudgetTradeoff(
  budget: number,
  afterCoverage: number,
  beforeCoverage: number,
  backendTradeoff?: string,
): string {
  const reduced =
    backendTradeoff
      ?.replace(/^Reduced basket to stay under \$[\d.]+\.\s*/, "")
      .replace(/Removed /g, "")
      .replace(/Reduced /g, "")
      .trim() ?? "some items";
  const nutrientNote =
    beforeCoverage - afterCoverage > 5
      ? " Your family's fiber coverage will be lower this week."
      : "";
  return `Under $${budget.toFixed(0)}: ${afterCoverage}% coverage. Reduced: ${reduced}.${nutrientNote}`;
}

const MEMBER_SUFFIX_RE = /\s*—\s*recommended for [^.]+\.?$/i;

/** Pull health explanations out of score lines (drops the "recommended for Name" tail). */
export function extractHealthReasons(scoreReasoning: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of scoreReasoning) {
    const cleaned = raw.replace(MEMBER_SUFFIX_RE, "").trim();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned.endsWith(".") ? cleaned : `${cleaned}.`);
  }
  return out;
}

/** Human-readable explanation for why a product landed in the weekly basket. */
export function formatBasketItemWhy(params: {
  category: string;
  membersBenefiting: string[];
  scoreReasoning: string[];
  headcount: number;
  variantLabel: string;
}): string {
  const { category, membersBenefiting, scoreReasoning, headcount, variantLabel } =
    params;

  const healthReasons = extractHealthReasons(scoreReasoning);
  let why: string;
  if (healthReasons.length > 0) {
    why = healthReasons.slice(0, 2).join(" ");
  } else if (membersBenefiting.length > 0) {
    why = `Nutrient-rich ${category.toLowerCase()} pick matched to your family's weekly needs.`;
  } else {
    why = `Covers your household's weekly ${category.toLowerCase()} nutrition.`;
  }

  const sizing =
    headcount === 1
      ? `Sized for 1 person at home (${variantLabel}).`
      : `Sized for ${headcount} people at home (${variantLabel}).`;

  return `${why} ${sizing}`;
}

/** Split stored basket copy into a clear "why" line and optional sizing note. */
export function getBasketItemCopy(item: {
  reasoning: string;
  membersBenefiting: string[];
}): { why: string; sizing: string | null } {
  const sizingMatch = item.reasoning.match(/(Sized for .+\)\.?)\s*$/i);
  const sizing = sizingMatch?.[1] ?? null;
  let why = sizingMatch
    ? item.reasoning.slice(0, sizingMatch.index).trim()
    : item.reasoning.trim();

  why = extractHealthReasons([why]).join(" ") || why;
  why = why.replace(MEMBER_SUFFIX_RE, "").trim();

  if (!why) {
    why =
      item.membersBenefiting.length > 0
        ? "Included because it fits your family's health profiles this week."
        : "Included to round out your family's weekly nutrition.";
  }

  return { why, sizing };
}

export function pickChatProductHighlights(params: {
  response: string;
  catalog: ProductDto[];
  scores: ScoredProduct[];
  basket?: BasketResult | null;
  addLimit?: number;
  limitLimit?: number;
}): { toAdd: ChatProductHighlight[]; toLimit: ChatProductHighlight[] } {
  const addLimit = params.addLimit ?? 6;
  const limitLimit = params.limitLimit ?? 3;
  const scoreMap = new Map(params.scores.map((s) => [s.productId, s]));
  const catalogMap = new Map(params.catalog.map((p) => [p.id, p]));
  const lower = params.response.toLowerCase();
  const seen = new Set<string>();

  const enrich = (
    productId: string,
    extra?: Partial<ChatProductHighlight>,
  ): ChatProductHighlight | null => {
    const p = catalogMap.get(productId);
    if (!p) return null;
    const s = scoreMap.get(productId);
    return {
      ...p,
      badge: s?.badge ?? p.badge,
      reasoning: s?.reasoning ?? p.reasoning,
      score: s?.score ?? p.score,
      ...extra,
    };
  };

  const toAdd: ChatProductHighlight[] = [];

  if (params.basket?.items.length) {
    const byCategory = new Map<string, typeof params.basket.items>();
    for (const item of params.basket.items) {
      const cat = item.category ?? "Other";
      const list = byCategory.get(cat) ?? [];
      list.push(item);
      byCategory.set(cat, list);
    }
    const categories = Array.from(byCategory.keys());
    for (let round = 0; toAdd.length < addLimit && round < 8; round++) {
      for (const cat of categories) {
        const item = byCategory.get(cat)?.[round];
        if (!item || seen.has(item.productId)) continue;
        const s = scoreMap.get(item.productId);
        if (s?.badge === "avoid") continue;
        const h = enrich(item.productId, {
          basketQty: item.quantity,
          variantLabel: `${item.variant.weightValue} ${item.variant.weightUnit}`,
          highlightReason: item.reasoning,
        });
        if (h) {
          toAdd.push(h);
          seen.add(item.productId);
        }
        if (toAdd.length >= addLimit) break;
      }
    }
  }

  for (const p of params.catalog) {
    if (toAdd.length >= addLimit) break;
    if (seen.has(p.id)) continue;
    if (!lower.includes(p.nameEn.toLowerCase())) continue;
    const s = scoreMap.get(p.id);
    if (s?.badge === "avoid" || s?.badge === "limit") continue;
    const h = enrich(p.id);
    if (h) {
      toAdd.push(h);
      seen.add(p.id);
    }
  }

  const ranked = [...params.scores].sort((a, b) => b.score - a.score);
  for (const s of ranked) {
    if (toAdd.length >= addLimit) break;
    if (seen.has(s.productId)) continue;
    if (s.badge === "avoid" || s.badge === "limit") continue;
    const h = enrich(s.productId);
    if (h) {
      toAdd.push(h);
      seen.add(s.productId);
    }
  }

  const toLimit: ChatProductHighlight[] = [];
  const limitScores = params.scores.filter(
    (s) => s.badge === "avoid" || s.badge === "limit",
  );
  const mentionedFirst = limitScores.filter((s) => {
    const p = catalogMap.get(s.productId);
    return p && lower.includes(p.nameEn.toLowerCase());
  });
  for (const s of [...mentionedFirst, ...limitScores]) {
    if (toLimit.length >= limitLimit) break;
    if (toLimit.some((x) => x.id === s.productId)) continue;
    const h = enrich(s.productId, {
      highlightReason: s.reasoning[0],
    });
    if (h) toLimit.push(h);
  }

  return { toAdd, toLimit };
}

/** @deprecated Use pickChatProductHighlights */
export function matchProductsInResponse(
  response: string,
  catalog: ProductDto[],
): ProductDto[] {
  return pickChatProductHighlights({
    response,
    catalog,
    scores: catalog.map((p) => ({
      productId: p.id,
      score: p.score ?? 0,
      badge: p.badge ?? "neutral",
      reasoning: p.reasoning ?? [],
    })),
  }).toAdd.slice(0, 3);
}
