import { prisma } from "./db";
import type { BasketItem, BasketResult } from "./types";

export async function enrichBasketItems(items: BasketItem[]): Promise<BasketItem[]> {
  const enriched: BasketItem[] = [];
  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { category: true, imageUrl: true },
    });
    enriched.push({
      ...item,
      category: product?.category ?? "Pantry",
      imageUrl: product?.imageUrl ?? null,
    });
  }
  return enriched;
}

export async function toBasketResult(
  record: {
    id: string;
    basketJson: unknown;
    coverageScore: number;
    totalPrice: { toString(): string } | number;
    context: string | null;
  },
  perMemberCoverage: Record<string, number>,
  coverageTradeoff?: string,
): Promise<BasketResult> {
  const items = await enrichBasketItems(record.basketJson as BasketItem[]);
  const totalPrice =
    typeof record.totalPrice === "number"
      ? record.totalPrice
      : parseFloat(record.totalPrice.toString());

  return {
    basketId: record.id,
    items,
    coverageScore: Math.round(record.coverageScore),
    perMemberCoverage,
    totalPrice,
    weeklyContext: record.context ?? "",
    coverageTradeoff,
  };
}
