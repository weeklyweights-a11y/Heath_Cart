import { prisma } from "@/lib/db";
import type { HouseholdState, ProductWithNutrition } from "../types";

const INTENT_TAG_MAP: Record<string, string[]> = {
  light_fresh: ["light_meal", "hydrating"],
  hot_weather: ["hydrating", "light_meal"],
  bbq: ["bbq_friendly"],
  keto: ["low_glycemic", "high_protein"],
  meal_prep: ["high_protein"],
  cold: ["hydrating", "vitamin_c_rich"],
};

export function intentTagFallbackScore(
  product: ProductWithNutrition,
  intents: string[],
): number {
  if (intents.length === 0) return 0;
  const tags = new Set(product.tags.map((t) => t.tag));
  let hits = 0;
  let total = 0;
  for (const intent of intents) {
    const preferred = INTENT_TAG_MAP[intent] ?? [];
    total += preferred.length || 1;
    for (const t of preferred) {
      if (tags.has(t)) hits++;
    }
  }
  return total > 0 ? Math.min(1, hits / total) : 0;
}

export async function findSimilarProductScores(
  state: HouseholdState,
  products: ProductWithNutrition[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const query = [state.cuisineMood, ...state.intents].filter(Boolean).join(" ");
  if (!query) {
    for (const p of products) out.set(p.id, 0);
    return out;
  }

  try {
    const rows = await prisma.$queryRawUnsafe<
      { product_id: string; similarity: number }[]
    >(
      `SELECT product_id, 1 - (embedding <=> (
        SELECT embedding FROM intent_embedding_cache WHERE intent_key = $1 LIMIT 1
      )) AS similarity
      FROM product_embedding
      WHERE product_id = ANY($2::text[])
      ORDER BY similarity DESC`,
      query.replace(/\s+/g, "_"),
      products.map((p) => p.id),
    );
    for (const r of rows) out.set(r.product_id, Number(r.similarity) || 0);
  } catch {
    for (const p of products) {
      out.set(p.id, intentTagFallbackScore(p, state.intents));
    }
  }
  for (const p of products) {
    if (!out.has(p.id)) out.set(p.id, intentTagFallbackScore(p, state.intents));
  }
  return out;
}
