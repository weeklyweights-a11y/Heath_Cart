import { prisma } from "./db";
import { loadFullFamily, toFamilyDto } from "./family-context";
import type { FamilyDto } from "./types";

export async function createFamily(name: string): Promise<FamilyDto> {
  const family = await prisma.family.create({
    data: { name },
    include: { members: true },
  });
  return toFamilyDto(family);
}

export async function getFamilyById(id: string): Promise<FamilyDto | null> {
  const family = await prisma.family.findUnique({
    where: { id },
    include: { members: true },
  });
  if (!family) return null;
  return toFamilyDto(family);
}

export async function addFamilyMember(
  familyId: string,
  data: {
    name: string;
    age: number;
    relation: import("@prisma/client").MemberRelation;
    dietType: import("@prisma/client").DietType;
    conditions: string[];
    allergies: string[];
    heightCm?: number;
    weightKg?: number;
    isTemporary?: boolean;
    startDate?: string;
    endDate?: string;
  },
): Promise<FamilyDto> {
  const exists = await prisma.family.findUnique({ where: { id: familyId } });
  if (!exists) throw new Error("Family not found");

  await prisma.familyMember.create({
    data: {
      familyId,
      name: data.name,
      age: data.age,
      relation: data.relation,
      dietType: data.dietType,
      conditions: data.conditions,
      allergies: data.allergies,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      isTemporary: data.isTemporary ?? false,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  });

  return loadFullFamily(familyId);
}

export async function updateFamilyMember(
  familyId: string,
  memberId: string,
  data: Partial<{
    name: string;
    age: number;
    relation: import("@prisma/client").MemberRelation;
    dietType: import("@prisma/client").DietType;
    conditions: string[];
    allergies: string[];
    heightCm: number;
    weightKg: number;
    isTemporary: boolean;
    startDate: string;
    endDate: string;
  }>,
): Promise<FamilyDto> {
  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, familyId },
  });
  if (!member) throw new Error("Member not found");

  await prisma.familyMember.update({
    where: { id: memberId },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  });

  return loadFullFamily(familyId);
}

export async function deleteFamilyMember(
  familyId: string,
  memberId: string,
): Promise<FamilyDto> {
  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, familyId },
  });
  if (!member) throw new Error("Member not found");

  await prisma.familyMember.delete({ where: { id: memberId } });
  return loadFullFamily(familyId);
}
