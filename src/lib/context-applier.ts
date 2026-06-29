import type { WeeklyContext } from "@prisma/client";
import { prisma } from "./db";
import type { ExtractedContext } from "./types";
import { emptyExtractedContext } from "./types";

function parseExisting(json: unknown): ExtractedContext {
  if (!json || typeof json !== "object") return emptyExtractedContext();
  const raw = json as Partial<ExtractedContext>;
  return {
    household_changes: raw.household_changes ?? [],
    membersAway: raw.membersAway ?? [],
    health_states: raw.health_states ?? [],
    dietary_needs: raw.dietary_needs ?? [],
    mood: raw.mood,
    practical_needs: raw.practical_needs ?? [],
    budgetUsd: raw.budgetUsd,
  };
}

function dedupeDietary(
  existing: ExtractedContext["dietary_needs"],
  incoming: ExtractedContext["dietary_needs"],
) {
  const key = (d: { date?: string; requirement: string }) =>
    `${d.date ?? ""}:${d.requirement.toLowerCase()}`;
  const map = new Map<string, (typeof existing)[0]>();
  for (const d of [...existing, ...incoming]) {
    map.set(key(d), d);
  }
  return Array.from(map.values());
}

function dedupePractical(
  existing: ExtractedContext["practical_needs"],
  incoming: ExtractedContext["practical_needs"],
) {
  const map = new Map<string, (typeof existing)[0]>();
  for (const p of [...existing, ...incoming]) {
    map.set(p.item.toLowerCase(), p);
  }
  return Array.from(map.values());
}

function mergeHealthStates(
  existing: ExtractedContext["health_states"],
  incoming: ExtractedContext["health_states"],
): ExtractedContext["health_states"] {
  const byMemberCondition = new Map<string, ExtractedContext["health_states"][0]>();

  for (const s of existing) {
    if (s.remove) continue;
    byMemberCondition.set(`${s.member}:${s.condition}`, s);
  }

  for (const s of incoming) {
    const key = `${s.member}:${s.condition}`;
    if (s.remove) {
      byMemberCondition.delete(key);
      continue;
    }
    byMemberCondition.set(key, s);
  }

  return Array.from(byMemberCondition.values());
}

export interface ApplyContextResult {
  mergedContext: ExtractedContext;
  cuisineMood: string | null;
  rawMessage: string;
}

export async function applyHouseholdChanges(
  familyId: string,
  changes: ExtractedContext["household_changes"],
): Promise<void> {
  for (const change of changes) {
    if (change.action === "add_temp" && change.name) {
      const existing = await prisma.familyMember.findFirst({
        where: { familyId, name: change.name },
      });
      if (existing) continue;

      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 7);

      await prisma.familyMember.create({
        data: {
          familyId,
          name: change.name,
          age: 65,
          relation: "other",
          dietType: "flexible",
          conditions: change.conditions ?? [],
          allergies: change.allergies ?? [],
          isTemporary: true,
          startDate: start,
          endDate: end,
        },
      });
    }

    if (change.action === "remove" && change.name) {
      await prisma.familyMember.deleteMany({
        where: { familyId, name: change.name, isTemporary: true },
      });
    }
  }
}

export function mergeExtractedContext(
  existing: ExtractedContext,
  incoming: ExtractedContext,
  message: string,
  existingRawMessage: string,
): ApplyContextResult {
  const membersAway = new Set(
    existing.membersAway.map((n) => n.toLowerCase()),
  );

  for (const change of incoming.household_changes) {
    if (change.action === "members_away" && change.name) {
      membersAway.add(change.name.toLowerCase());
    }
    if (change.action === "remove" && change.name) {
      membersAway.delete(change.name.toLowerCase());
    }
  }

  for (const change of incoming.household_changes) {
    if (change.action === "members_away" && !change.name) {
      for (const name of parseAwayNamesFromChange(change)) {
        membersAway.add(name.toLowerCase());
      }
    }
  }

  const merged: ExtractedContext = {
    household_changes: [
      ...existing.household_changes,
      ...incoming.household_changes,
    ],
    membersAway: Array.from(membersAway).map(
      (lower) =>
        existing.membersAway.find((n) => n.toLowerCase() === lower) ??
        incoming.household_changes.find(
          (c) => c.name?.toLowerCase() === lower,
        )?.name ??
        lower,
    ),
    health_states: mergeHealthStates(
      existing.health_states,
      incoming.health_states,
    ),
    dietary_needs: dedupeDietary(
      existing.dietary_needs,
      incoming.dietary_needs,
    ),
    practical_needs: dedupePractical(
      existing.practical_needs,
      incoming.practical_needs,
    ),
    mood: incoming.mood ?? existing.mood,
    budgetUsd: incoming.budgetUsd ?? existing.budgetUsd,
  };

  const cuisineMood = merged.mood?.overall ?? null;
  const rawMessage = existingRawMessage
    ? `${existingRawMessage}\n${message}`
    : message;

  return { mergedContext: merged, cuisineMood, rawMessage };
}

function parseAwayNamesFromChange(
  change: ExtractedContext["household_changes"][0],
): string[] {
  if (change.name) return [change.name];
  return [];
}

export async function applyExtractedContext(
  familyId: string,
  incoming: ExtractedContext,
  existingWeekly: WeeklyContext | null,
  message: string,
): Promise<ApplyContextResult> {
  await applyHouseholdChanges(familyId, incoming.household_changes);

  const existing = existingWeekly
    ? parseExisting(existingWeekly.extractedContext)
    : emptyExtractedContext();

  return mergeExtractedContext(
    existing,
    incoming,
    message,
    existingWeekly?.rawMessage ?? "",
  );
}

export function parseStoredContext(weekly: WeeklyContext | null): ExtractedContext {
  if (!weekly) return emptyExtractedContext();
  return parseExisting(weekly.extractedContext);
}
