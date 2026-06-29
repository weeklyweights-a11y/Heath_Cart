import { NextRequest } from "next/server";
import {
  badRequest,
  basketAddSchema,
  ok,
  serverError,
} from "@/lib/api-helpers";
import { addItemToBasket } from "@/lib/optimizer";

export async function POST(request: NextRequest) {
  try {
    const body = basketAddSchema.safeParse(await request.json());
    if (!body.success) return badRequest(body.error.message);

    const basket = await addItemToBasket(
      body.data.familyId,
      body.data.productId,
      body.data.variantId,
      body.data.quantity ?? 1,
      body.data.basketId,
    );
    return ok(basket);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Add failed");
  }
}
