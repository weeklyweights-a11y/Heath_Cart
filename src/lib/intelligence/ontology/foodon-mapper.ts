const OLS_BASE =
  process.env.FOODON_OLS_BASE ?? "https://www.ebi.ac.uk/ols4/api";

export async function lookupFoodonByLabel(label: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(label);
    const res = await fetch(
      `${OLS_BASE}/search?q=${q}&ontology=foodon&size=1`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      response?: { docs?: { obo_id?: string }[] };
    };
    return data.response?.docs?.[0]?.obo_id ?? null;
  } catch {
    return null;
  }
}

export const FOODON_ATTRIBUTION =
  "Product ontology mappings use FoodOn (CC BY 4.0). https://foodon.org";
