import "./load-env";
import { prisma } from "./prisma-client";

async function main(): Promise<void> {
  const rules = await prisma.healthConditionRule.findMany({
    where: { isActive: true },
    select: { targetTag: true, condition: true },
  });

  const orphans: string[] = [];
  for (const r of rules) {
    const count = await prisma.dietaryTag.count({
      where: { tag: r.targetTag, product: { isActive: true } },
    });
    if (count === 0) orphans.push(`${r.condition} → ${r.targetTag} (0 products)`);
  }

  if (orphans.length) {
    console.error("Orphan targetTags (no products):");
    orphans.forEach((o) => console.error(" ", o));
    process.exit(1);
  }
  console.log(`Tag coverage: PASS (${rules.length} rules checked)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
