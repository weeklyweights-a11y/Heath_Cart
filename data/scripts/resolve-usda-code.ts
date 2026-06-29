import { prisma } from "./prisma-client";

/**
 * Resolve USDA foodCode by fuzzy nameEn match in NutritionLookup.
 * Returns null when no match — caller may use catalog override or Open Food Facts.
 */
export async function resolveUsdaCode(
  nameEn: string,
  category?: string,
): Promise<number | null> {
  const term = nameEn.trim();
  const exact = await prisma.nutritionLookup.findFirst({
    where: { nameEn: { equals: term, mode: "insensitive" } },
    select: { foodCode: true },
  });
  if (exact) return exact.foodCode;

  const contains = await prisma.nutritionLookup.findFirst({
    where: { nameEn: { contains: term, mode: "insensitive" } },
    orderBy: { nameEn: "asc" },
    select: { foodCode: true },
  });
  if (contains) return contains.foodCode;

  const firstWord = term.split(/\s+/)[0];
  if (firstWord.length >= 4) {
    const word = await prisma.nutritionLookup.findFirst({
      where: { nameEn: { contains: firstWord, mode: "insensitive" } },
      orderBy: { nameEn: "asc" },
      select: { foodCode: true },
    });
    if (word) return word.foodCode;
  }

  if (category) {
    const byGroup = await prisma.nutritionLookup.findFirst({
      where: {
        nameEn: { contains: firstWord, mode: "insensitive" },
        foodGroup: { contains: category, mode: "insensitive" },
      },
      select: { foodCode: true },
    });
    if (byGroup) return byGroup.foodCode;
  }

  return null;
}
