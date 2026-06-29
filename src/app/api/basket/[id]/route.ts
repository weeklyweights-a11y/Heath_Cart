import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api-helpers";
import { getBasketById } from "@/lib/optimizer";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const basket = await getBasketById(params.id);
    return ok(basket);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Basket load failed";
    return serverError(msg);
  }
}
