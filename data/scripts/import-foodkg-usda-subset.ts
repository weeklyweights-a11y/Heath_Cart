import "./load-env";
import { prisma } from "./prisma-client";

/** ponytail: Phase 7 stub — FoodKG USDA subset crosswalk deferred to manual CSV */
async function main(): Promise<void> {
  console.log(
    "import-foodkg-usda-subset: stub — use map-foodon.ts OLS lookup or add usda-links CSV later",
  );
  const unmapped = await prisma.product.count({
    where: { isActive: true, foodonId: null },
  });
  console.log(`Products without foodonId: ${unmapped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
