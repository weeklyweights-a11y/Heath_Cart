import "./load-env";
import { prisma } from "./prisma-client";
import { lookupFoodonByLabel } from "../../src/lib/intelligence/ontology/foodon-mapper";

async function main(): Promise<void> {
  const products = await prisma.product.findMany({
    where: { isActive: true, foodonId: null },
    select: { id: true, nameEn: true, usdaFoodCode: true },
  });

  let mapped = 0;
  for (const p of products) {
    const foodonId = await lookupFoodonByLabel(p.nameEn);
    if (foodonId) {
      await prisma.product.update({
        where: { id: p.id },
        data: { foodonId },
      });
      mapped++;
    }
  }

  const total = await prisma.product.count({ where: { isActive: true } });
  const withId = await prisma.product.count({
    where: { isActive: true, foodonId: { not: null } },
  });
  console.log(`FoodOn mapped: ${mapped} new, ${withId}/${total} total (${((withId / total) * 100).toFixed(0)}%)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
