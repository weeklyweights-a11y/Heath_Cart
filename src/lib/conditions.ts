const CONDITION_ALIASES: Record<string, string> = {
  pre_diabetic: "diabetes",
  "pre-diabetic": "diabetes",
  prediabetic: "diabetes",
  high_cholesterol: "cholesterol",
  gluten_intolerance: "celiac",
};

export function normalizeCondition(
  condition: string,
  fromWeeklyContext = false,
): string {
  const lower = condition.toLowerCase().trim().replace(/\s+/g, "_");
  if (lower === "weight_management" && fromWeeklyContext) {
    return "obesity";
  }
  return CONDITION_ALIASES[lower] ?? lower;
}

export function memberConditionsFromProfile(
  conditions: string[],
  allergies: string[],
): string[] {
  const set = new Set<string>();
  for (const c of conditions) {
    set.add(normalizeCondition(c));
  }
  for (const a of allergies) {
    const lower = a.toLowerCase();
    if (lower.includes("peanut")) set.add("peanut_allergy");
    if (lower.includes("gluten")) set.add("celiac");
    if (lower.includes("lactose")) set.add("lactose_intolerance");
  }
  return Array.from(set);
}

export function mergeWeeklyHealthStates(
  memberName: string,
  states: { member: string; condition: string; since?: string; remove?: boolean }[],
  expireDays: Map<string, number | null>,
  referenceDate: Date,
): string[] {
  const result: string[] = [];
  for (const state of states) {
    if (state.member.toLowerCase() !== memberName.toLowerCase()) continue;
    if (state.remove) continue;
    const condition = normalizeCondition(state.condition, true);
    const days = expireDays.get(condition);
    if (days != null && state.since) {
      const since = parseSinceDate(state.since, referenceDate);
      const elapsed =
        (referenceDate.getTime() - since.getTime()) / (1000 * 60 * 60 * 24);
      if (elapsed > days) continue;
    }
    result.push(condition);
  }
  return result;
}

function parseSinceDate(since: string, ref: Date): Date {
  const lower = since.toLowerCase();
  if (lower === "today") return new Date(ref);
  if (lower === "yesterday") {
    const d = new Date(ref);
    d.setDate(d.getDate() - 1);
    return d;
  }
  const parsed = new Date(since);
  return Number.isNaN(parsed.getTime()) ? ref : parsed;
}

export function isKnownCondition(
  condition: string,
  known: Set<string>,
): boolean {
  const normalized = normalizeCondition(condition);
  return known.has(normalized) || known.has(condition);
}
