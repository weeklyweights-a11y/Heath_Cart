import { readFileSync } from "fs";
import { resolve } from "path";

export type NutrientColumn =
  | "energyKcal"
  | "proteinG"
  | "totalFatG"
  | "carbsG"
  | "fiberG"
  | "sugarG"
  | "ironMg"
  | "calciumMg"
  | "vitaminAUg"
  | "vitaminCMg"
  | "folateMg"
  | "potassiumMg"
  | "sodiumMg"
  | "saturatedFatG"
  | "magnesiumMg"
  | "glycemicIndex";

export interface NutritionRow {
  foodCode: number;
  foodGroup: string | null;
  nameEn: string;
  nameHi: null;
  nameTe: null;
  energyKcal: number | null;
  proteinG: number | null;
  totalFatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  ironMg: number | null;
  calciumMg: number | null;
  vitaminAUg: number | null;
  vitaminCMg: number | null;
  folateMg: number | null;
  potassiumMg: number | null;
  sodiumMg: number | null;
  saturatedFatG: number | null;
  magnesiumMg: number | null;
  glycemicIndex: number | null;
}

export function loadNutrientIdMap(): Record<string, NutrientColumn> {
  const raw = readFileSync(
    resolve(process.cwd(), "data/usda/nutrient-id-map.json"),
    "utf8",
  );
  return JSON.parse(raw) as Record<string, NutrientColumn>;
}

/** Folate stored as mg; FDC reports mcg DFE — divide by 1000 on import. */
export function normalizeNutrientValue(
  column: NutrientColumn,
  value: number,
): number {
  if (column === "folateMg") return value / 1000;
  return value;
}

export let usdaImportBaselineCount = 0;

export function setUsdaImportBaseline(count: number): void {
  usdaImportBaselineCount = count;
}

export function getUsdaImportBaseline(): number {
  if (usdaImportBaselineCount > 0) return usdaImportBaselineCount;
  const baselinePath = resolve(process.cwd(), "data/usda/import-baseline.txt");
  try {
    const n = parseInt(readFileSync(baselinePath, "utf8").trim(), 10);
    return Number.isFinite(n) ? n : 2000;
  } catch {
    return 2000;
  }
}
