import { NextRequest } from "next/server";
import { notFound, ok, serverError } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { scoreProductsForFamily } from "@/lib/scoring";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const familyId = request.nextUrl.searchParams.get("familyId") ?? undefined;

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        variants: true,
        tags: true,
        nutrition: true,
      },
    });

    if (!product) return notFound("Product not found");

    let scoreInfo: {
      score: number;
      badge: string;
      reasoning: string[];
    } | null = null;

    if (familyId) {
      const scores = await scoreProductsForFamily(familyId);
      const match = scores.find((s) => s.productId === product.id);
      if (match) {
        scoreInfo = {
          score: match.score,
          badge: match.badge,
          reasoning: match.reasoning,
        };
      }
    }

    const cheapest = product.variants.reduce(
      (min, v) => Math.min(min, Number(v.price)),
      Number(product.variants[0]?.price ?? 0),
    );

    return ok({
      id: product.id,
      nameEn: product.nameEn,
      category: product.category,
      subcategory: product.subcategory,
      description: product.description,
      imageUrl: product.imageUrl,
      price: cheapest,
      variants: product.variants.map((v) => ({
        id: v.id,
        weightValue: v.weightValue,
        weightUnit: v.weightUnit,
        price: Number(v.price),
      })),
      tags: product.tags.map((t) => t.tag),
      nutrition: product.nutrition,
      ...scoreInfo,
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Product failed");
  }
}
