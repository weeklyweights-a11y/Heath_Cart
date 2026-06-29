import type { FamilyMember, WeeklyContext } from "@prisma/client";
import { prisma } from "./db";
import {
  memberConditionsFromProfile,
  mergeWeeklyHealthStates,
} from "./conditions";
import type {
  ActiveMember,
  ExtractedContext,
  FamilyDto,
  FamilyMemberDto,
} from "./types";
import { emptyExtractedContext } from "./types";
import { getWeekStart, toDateOnly } from "./week";

export interface FamilyContextResult {
  familyId: string;
  familyName: string;
  activeMembers: ActiveMember[];
  weeklyContext: WeeklyContext | null;
  extractedContext: ExtractedContext;
  referenceDate: Date;
}

function parseExtractedContext(json: unknown): ExtractedContext {
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

function isMemberActive(member: FamilyMember, now: Date): boolean {
  if (!member.isTemporary) return true;
  if (!member.startDate || !member.endDate) return true;
  return now >= member.startDate && now <= member.endDate;
}

export async function buildActiveFamilyContext(
  familyId: string,
  referenceDate = new Date(),
): Promise<FamilyContextResult> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { members: true },
  });
  if (!family) throw new Error("Family not found");

  const weekStart = toDateOnly(getWeekStart(referenceDate));
  const weeklyContext = await prisma.weeklyContext.findUnique({
    where: {
      familyId_weekStart: { familyId, weekStart },
    },
  });

  const extractedContext = parseExtractedContext(
    weeklyContext?.extractedContext,
  );
  const awaySet = new Set(
    extractedContext.membersAway.map((n) => n.toLowerCase()),
  );

  const rules = await prisma.healthConditionRule.findMany({
    where: { isActive: true },
  });
  const expireDays = new Map<string, number | null>();
  for (const r of rules) {
    if (r.autoExpireDays != null && !expireDays.has(r.condition)) {
      expireDays.set(r.condition, r.autoExpireDays);
    }
  }

  const activeMembers: ActiveMember[] = [];

  for (const member of family.members) {
    if (!isMemberActive(member, referenceDate)) continue;

    const chronic = memberConditionsFromProfile(
      member.conditions,
      member.allergies,
    );
    const weekly = mergeWeeklyHealthStates(
      member.name,
      extractedContext.health_states,
      expireDays,
      referenceDate,
    );
    const effectiveConditions = Array.from(new Set([...chronic, ...weekly]));
    const isAway = awaySet.has(member.name.toLowerCase());

    activeMembers.push({
      id: member.id,
      name: member.name,
      age: member.age,
      relation: member.relation,
      dietType: member.dietType,
      conditions: member.conditions,
      allergies: member.allergies,
      isTemporary: member.isTemporary,
      isAway,
      effectiveConditions,
    });
  }

  return {
    familyId: family.id,
    familyName: family.name,
    activeMembers: activeMembers.filter((m) => !m.isAway),
    weeklyContext,
    extractedContext,
    referenceDate,
  };
}

export function toFamilyDto(
  family: {
    id: string;
    name: string;
    createdAt: Date;
    members: FamilyMember[];
  },
): FamilyDto {
  return {
    id: family.id,
    name: family.name,
    createdAt: family.createdAt.toISOString(),
    members: family.members.map(toMemberDto),
  };
}

export function toMemberDto(member: FamilyMember): FamilyMemberDto {
  return {
    id: member.id,
    name: member.name,
    age: member.age,
    relation: member.relation,
    dietType: member.dietType,
    conditions: member.conditions,
    allergies: member.allergies,
    heightCm: member.heightCm,
    weightKg: member.weightKg,
    isTemporary: member.isTemporary,
    startDate: member.startDate?.toISOString() ?? null,
    endDate: member.endDate?.toISOString() ?? null,
  };
}

export async function loadFullFamily(familyId: string): Promise<FamilyDto> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { members: true },
  });
  if (!family) throw new Error("Family not found");
  return toFamilyDto(family);
}
