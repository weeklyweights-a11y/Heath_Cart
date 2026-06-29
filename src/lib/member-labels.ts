import type { ExtractedContext, FamilyMemberDto, HealthBadge, ProductDto } from "./types";

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

export function matchProductsInResponse(
  response: string,
  catalog: ProductDto[],
): ProductDto[] {
  const lower = response.toLowerCase();
  const matched = catalog.filter((p) => lower.includes(p.nameEn.toLowerCase()));
  if (matched.length) return matched.slice(0, 3);
  return catalog
    .filter((p) => p.badge === "avoid" || p.badge === "limit")
    .slice(0, 3);
}
