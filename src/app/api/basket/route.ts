import { NextRequest } from "next/server";
import {
  badRequest,
  basketBodySchema,
  ok,
  serverError,
} from "@/lib/api-helpers";
import { generateBasket } from "@/lib/optimizer";

export async function POST(request: NextRequest) {
  try {
    const body = basketBodySchema.safeParse(await request.json());
    if (!body.success) return badRequest(body.error.message);

    const basket = await generateBasket(body.data.familyId, {
      budget: body.data.budget,
    });
    return ok(basket);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Basket failed");
  }
}
