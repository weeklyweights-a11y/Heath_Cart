import { NextRequest } from "next/server";
import { badRequest, ok, serverError } from "@/lib/api-helpers";
import { getScoredProductDetails } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  try {
    const familyId = request.nextUrl.searchParams.get("familyId");
    if (!familyId) {
      return badRequest("familyId is required");
    }
    const category = request.nextUrl.searchParams.get("category") ?? undefined;
    const products = await getScoredProductDetails(familyId, category);
    return ok({ total: products.length, products });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Scoring failed");
  }
}
