import "./load-env";
import { seedJohnson } from "../../src/lib/seed-johnson";
import { generateBasket } from "../../src/lib/optimizer";
import { prisma } from "./prisma-client";

async function main() {
  const f = await seedJohnson(false);
  const b = await generateBasket(f.id);
  const byCat = new Map<string, number>();
  for (const i of b.items) {
    const c = i.category ?? "?";
    byCat.set(c, (byCat.get(c) ?? 0) + i.price);
  }
  console.log("Weekly basket sample (Johnson family, 4 active members):");
  console.log(`  Items: ${b.items.length}`);
  console.log(`  Total: $${b.totalPrice.toFixed(2)}`);
  console.log(`  Coverage: ${b.coverageScore}%`);
  console.log(`  If shopped weekly × 4 weeks: $${(b.totalPrice * 4).toFixed(2)}/mo`);
  console.log("  By category:");
  for (const [c, v] of [...byCat.entries()].sort()) {
    console.log(`    ${c}: $${v.toFixed(2)}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
