import { ok, serverError } from "@/lib/api-helpers";
import { seedJohnson } from "@/lib/seed-johnson";

export async function POST() {
  try {
    const family = await seedJohnson(true);
    return ok({ familyId: family.id, family });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Demo seed failed");
  }
}
