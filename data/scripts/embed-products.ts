import "./load-env";
import { prisma } from "./prisma-client";
import { embedProduct } from "../../src/lib/intelligence/vectors/embed";
import { isPgVectorEnabled } from "../../src/lib/intelligence/config";

async function main(): Promise<void> {
  if (!isPgVectorEnabled()) {
    console.log("PGVECTOR_ENABLED=false — skipping embed-products (semantic score uses intent fallback)");
    return;
  }

  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS product_embedding (
        product_id TEXT PRIMARY KEY,
        embedding vector(768)
      )
    `);
  } catch (e) {
    console.warn("pgvector setup failed — offline fallback only:", e);
    return;
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { tags: true },
  });

  for (const p of products) {
    const vec = await embedProduct(p);
    const literal = `[${vec.join(",")}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO product_embedding (product_id, embedding) VALUES ($1, $2::vector)
       ON CONFLICT (product_id) DO UPDATE SET embedding = EXCLUDED.embedding`,
      p.id,
      literal,
    );
  }
  console.log(`Embedded ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
