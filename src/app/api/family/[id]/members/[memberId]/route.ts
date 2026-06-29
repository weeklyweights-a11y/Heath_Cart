import { NextRequest } from "next/server";
import {
  badRequest,
  familyMemberBodySchema,
  notFound,
  ok,
  serverError,
} from "@/lib/api-helpers";
import {
  deleteFamilyMember,
  updateFamilyMember,
} from "@/lib/family-service";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } },
) {
  try {
    const body = familyMemberBodySchema.partial().safeParse(await request.json());
    if (!body.success) {
      return badRequest(body.error.message);
    }
    const family = await updateFamilyMember(
      params.id,
      params.memberId,
      body.data,
    );
    return ok(family);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update member";
    if (msg === "Member not found") return notFound(msg);
    return serverError(msg);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; memberId: string } },
) {
  try {
    const family = await deleteFamilyMember(params.id, params.memberId);
    return ok(family);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete member";
    if (msg === "Member not found") return notFound(msg);
    return serverError(msg);
  }
}
