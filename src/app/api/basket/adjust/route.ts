import { NextRequest } from "next/server";
import {
  badRequest,
  basketAdjustSchema,
  notFound,
  ok,
  serverError,
} from "@/lib/api-helpers";
import { adjustBasket } from "@/lib/optimizer";

export async function PUT(request: NextRequest) {
  try {
    const body = basketAdjustSchema.safeParse(await request.json());
    if (!body.success) return badRequest(body.error.message);

    const basket = await adjustBasket(
      body.data.familyId,
      body.data.basketId,
      body.data.adjustments,
    );
    return ok(basket);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Adjust failed";
    if (msg === "Basket not found") return notFound(msg);
    return serverError(msg);
  }
}
