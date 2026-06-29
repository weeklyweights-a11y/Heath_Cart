import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { scoreProductsForFamily } from "@/lib/scoring";
import type { HealthBadge } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const familyId = searchParams.get("familyId") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "24", 10) || 24,
      100,
    );
    const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

    let scoreMap = new Map<
      string,
      { score: number; badge: HealthBadge; reasoning: string[] }
    >();

    if (familyId) {
      const scores = await scoreProductsForFamily(familyId);
      scoreMap = new Map(
        scores.map((s) => [
          s.productId,
          { score: s.score, badge: s.badge, reasoning: s.reasoning },
        ]),
      );
    }

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(category ? { category } : {}),
        ...(search
          ? { nameEn: { contains: search, mode: "insensitive" as const } }
          : {}),
      },
      include: { variants: true },
    });

    const mapped = products.map((p) => {
      const cheapest = p.variants.reduce(
        (min, v) => Math.min(min, Number(v.price)),
        Number(p.variants[0]?.price ?? 0),
      );
      const s = scoreMap.get(p.id);
      return {
        id: p.id,
        nameEn: p.nameEn,
        category: p.category,
        price: cheapest,
        imageUrl: p.imageUrl,
        score: s?.score,
        badge: s?.badge,
        reasoning: s ? s.reasoning.slice(0, 2) : undefined,
      };
    });

    if (familyId) {
      mapped.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    } else {
      mapped.sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.nameEn.localeCompare(b.nameEn),
      );
    }

    const page = mapped.slice(offset, offset + limit);
    return ok({ total: mapped.length, products: page });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Products failed");
  }
}
