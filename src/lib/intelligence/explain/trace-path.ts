import { extractHealthReasons } from "@/lib/member-labels";
import type { ItemExplanation, ScoreBreakdown } from "../types";
import type { ActiveMember } from "@/lib/types";

export function buildItemExplanation(params: {
  productName: string;
  category: string;
  membersBenefiting: string[];
  scoreReasoning: string[];
  scoreBreakdown?: ScoreBreakdown;
  graphPath?: string[];
  constraintsChecked: string[];
  headcount: number;
  variantLabel: string;
}): ItemExplanation {
  const healthReasons = extractHealthReasons(params.scoreReasoning);
  let why: string;
  if (healthReasons.length > 0) {
    why = healthReasons.slice(0, 2).join(" ");
  } else if (params.membersBenefiting.length > 0) {
    why = `Nutrient-rich ${params.category.toLowerCase()} pick matched to your family's weekly needs.`;
  } else {
    why = `Covers your household's weekly ${params.category.toLowerCase()} nutrition.`;
  }

  const sizing =
    params.headcount === 1
      ? `Sized for 1 person at home (${params.variantLabel}).`
      : `Sized for ${params.headcount} people at home (${params.variantLabel}).`;

  return {
    why,
    goodFor: params.membersBenefiting,
    graphPath: params.graphPath ?? params.scoreBreakdown?.graphPaths?.[0] ?? [],
    scoreBreakdown: params.scoreBreakdown,
    constraintsChecked: params.constraintsChecked,
    sizing,
  };
}

export function explanationToReasoning(explanation: ItemExplanation): string {
  return `${explanation.why} ${explanation.sizing}`;
}

export function membersBenefitingFromGraph(
  productTags: string[],
  members: ActiveMember[],
  requiredTags: Map<string, { reason: string }>,
): string[] {
  const names: string[] = [];
  for (const m of members) {
    for (const cond of m.effectiveConditions) {
      void cond;
      const matched = productTags.some((t) => requiredTags.has(t));
      if (matched && !names.includes(m.name)) names.push(m.name);
    }
  }
  return names;
}
