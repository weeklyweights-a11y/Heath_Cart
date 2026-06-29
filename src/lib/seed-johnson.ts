import { prisma } from "@/lib/db";
import { loadFullFamily } from "@/lib/family-context";

const JOHNSON_NAME = "Johnson";

async function clearMembers(familyId: string) {
  await prisma.familyMember.deleteMany({ where: { familyId } });
}

async function getOrCreateFamily() {
  let family = await prisma.family.findFirst({ where: { name: JOHNSON_NAME } });
  if (!family) {
    family = await prisma.family.create({ data: { name: JOHNSON_NAME } });
  }
  return family;
}

async function seedMembers(familyId: string, includeLinda: boolean) {
  await clearMembers(familyId);

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);

  await prisma.familyMember.createMany({
    data: [
      {
        familyId,
        name: "Mike",
        age: 52,
        relation: "self",
        dietType: "non_vegetarian",
        conditions: ["cholesterol", "diabetes"],
        allergies: [],
      },
      {
        familyId,
        name: "Sarah",
        age: 48,
        relation: "spouse",
        dietType: "flexible",
        conditions: ["obesity"],
        allergies: [],
      },
      {
        familyId,
        name: "Jake",
        age: 14,
        relation: "child",
        dietType: "non_vegetarian",
        conditions: [],
        allergies: ["peanut"],
      },
      ...(includeLinda
        ? [
            {
              familyId,
              name: "Linda",
              age: 70,
              relation: "parent" as const,
              dietType: "flexible" as const,
              conditions: ["celiac"],
              allergies: [] as string[],
              isTemporary: true,
              startDate: start,
              endDate: end,
            },
          ]
        : []),
    ],
  });
}

export async function seedJohnson(includeLinda = true) {
  const family = await getOrCreateFamily();
  await seedMembers(family.id, includeLinda);
  return loadFullFamily(family.id);
}
