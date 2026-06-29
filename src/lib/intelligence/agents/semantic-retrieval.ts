import type { HouseholdState, ProductWithNutrition } from "../types";
import { isPgVectorEnabled } from "../config";
import { intentTagFallbackScore } from "../vectors/pgvector-store";

/** ponytail: semantic score = 0 when pgvector disabled; intent→tag fallback only */
export async function getSemanticScoresForProducts(
  state: HouseholdState,
  products: ProductWithNutrition[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!isPgVectorEnabled()) {
    for (const p of products) {
      out.set(p.id, intentTagFallbackScore(p, state.intents));
    }
    return out;
  }

  try {
    const { findSimilarProductScores } = await import("../vectors/pgvector-store");
    return await findSimilarProductScores(state, products);
  } catch {
    for (const p of products) {
      out.set(p.id, intentTagFallbackScore(p, state.intents));
    }
    return out;
  }
}
