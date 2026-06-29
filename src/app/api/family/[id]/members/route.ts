import { NextRequest } from "next/server";
import {
  badRequest,
  familyMemberBodySchema,
  notFound,
  ok,
  serverError,
} from "@/lib/api-helpers";
import { addFamilyMember } from "@/lib/family-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = familyMemberBodySchema.safeParse(await request.json());
    if (!body.success) {
      return badRequest(body.error.message);
    }
    const family = await addFamilyMember(params.id, body.data);
    return ok(family, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add member";
    if (msg === "Family not found") return notFound(msg);
    return serverError(msg);
  }
}
