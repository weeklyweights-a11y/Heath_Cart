import { NextRequest } from "next/server";
import {
  badRequest,
  createFamilySchema,
  ok,
  serverError,
} from "@/lib/api-helpers";
import { createFamily } from "@/lib/family-service";

export async function POST(request: NextRequest) {
  try {
    const body = createFamilySchema.safeParse(await request.json());
    if (!body.success) {
      return badRequest(body.error.message);
    }
    const family = await createFamily(body.data.name);
    return ok(family, 201);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to create family");
  }
}
