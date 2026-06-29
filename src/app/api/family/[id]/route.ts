import { NextRequest } from "next/server";
import { notFound, ok, serverError } from "@/lib/api-helpers";
import { getFamilyById } from "@/lib/family-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const family = await getFamilyById(params.id);
    if (!family) return notFound("Family not found");
    return ok(family);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to load family");
  }
}
