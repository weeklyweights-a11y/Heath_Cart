/**
 * Import USDA Foundation Foods + SR Legacy CSV into NutritionLookup.
 * foodCode = fdc_id; SR Legacy fallback = NDB_number when fdc_id absent.
 */
import "./load-env";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "fs";
import { createWriteStream } from "fs";
import { resolve, join } from "path";
import { parse } from "csv-parse";
import { get as httpsGet } from "https";
import { execSync } from "child_process";
import { prisma } from "./prisma-client";
import {
  loadNutrientIdMap,
  normalizeNutrientValue,
  type NutritionRow,
  type NutrientColumn,
  setUsdaImportBaseline,
} from "./usda-utils";

const RAW_DIR = resolve(process.cwd(), "data/usda/raw");
const BASELINE_FILE = resolve(process.cwd(), "data/usda/import-baseline.txt");
const USDA_JSON = resolve(process.cwd(), "data/usda/usda_data.json");
const SAMPLE_JSON = resolve(process.cwd(), "data/usda/sample.json");

const DATASETS = [
  {
    name: "foundation",
    url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2025-04-24.zip",
    zipName: "foundation_food.zip",
  },
  {
    name: "sr_legacy",
    url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip",
    zipName: "sr_legacy.zip",
  },
];

const BATCH = 2000;

async function downloadFile(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) {
    console.log("Already downloaded:", dest);
    return;
  }
  console.log("Downloading:", url);
  await new Promise<void>((resolveDl, reject) => {
    const file = createWriteStream(dest);
    httpsGet(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error("Redirect without location"));
        res.resume();
        return downloadFile(loc, dest).then(resolveDl).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolveDl();
      });
    }).on("error", reject);
  });
}

function extractZip(zipPath: string, outDir: string): void {
  const marker = join(outDir, ".extracted-" + zipPath.split(/[/\\]/).pop());
  if (existsSync(marker)) return;
  mkdirSync(outDir, { recursive: true });
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" },
  );
  writeFileSync(marker, new Date().toISOString());
}

async function parseCsv<T extends Record<string, string>>(
  filePath: string,
): Promise<T[]> {
  if (!existsSync(filePath)) return [];
  const rows: T[] = [];
  const parser = createReadStream(filePath).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_column_count: true }),
  );
  for await (const row of parser) {
    rows.push(row as T);
  }
  return rows;
}

function findCsvFile(dir: string, baseName: string): string | null {
  if (!existsSync(dir)) return null;
  const { readdirSync } = require("fs") as typeof import("fs");
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else if (entry.name.toLowerCase() === baseName.toLowerCase()) return p;
    }
  }
  return null;
}

function emptyRow(): Omit<NutritionRow, "foodCode" | "nameEn" | "foodGroup"> {
  return {
    nameHi: null,
    nameTe: null,
    energyKcal: null,
    proteinG: null,
    totalFatG: null,
    carbsG: null,
    fiberG: null,
    sugarG: null,
    ironMg: null,
    calciumMg: null,
    vitaminAUg: null,
    vitaminCMg: null,
    folateMg: null,
    potassiumMg: null,
    sodiumMg: null,
    saturatedFatG: null,
    magnesiumMg: null,
    glycemicIndex: null,
  };
}

async function loadDataset(
  extractDir: string,
  nutrientMap: Record<string, NutrientColumn>,
  useNdbFallback: boolean,
): Promise<Map<number, NutritionRow>> {
  const foodPath = findCsvFile(extractDir, "food.csv");
  const nutrientPath = findCsvFile(extractDir, "food_nutrient.csv");
  const categoryPath = findCsvFile(extractDir, "food_category.csv");

  if (!foodPath || !nutrientPath) {
    console.warn("Missing CSV in", extractDir);
    return new Map();
  }

  const categories = categoryPath
    ? await parseCsv<{ id: string; description: string }>(categoryPath)
    : [];
  const catById = new Map(categories.map((c) => [c.id, c.description]));

  const foods = await parseCsv<Record<string, string>>(foodPath);
  const nutrients = await parseCsv<Record<string, string>>(nutrientPath);

  const byFood = new Map<number, NutritionRow>();

  for (const f of foods) {
    const fdcId = parseInt(f.fdc_id ?? "", 10);
    const ndb = parseInt(f.NDB_number ?? f.ndb_number ?? "", 10);
    const foodCode =
      Number.isFinite(fdcId) && fdcId > 0
        ? fdcId
        : useNdbFallback && Number.isFinite(ndb) && ndb > 0
          ? ndb
          : null;
    if (!foodCode) continue;

    const desc = (f.description ?? f.long_description ?? "").trim();
    if (!desc) continue;

    const catId = f.food_category_id ?? f.food_category ?? "";
    const foodGroup = catById.get(catId) ?? null;

    byFood.set(foodCode, {
      foodCode,
      nameEn: desc,
      foodGroup,
      ...emptyRow(),
    });
  }

  for (const n of nutrients) {
    const fdcId = parseInt(n.fdc_id ?? "", 10);
    if (!Number.isFinite(fdcId)) continue;
    const row = byFood.get(fdcId);
    if (!row) continue;

    const col = nutrientMap[n.nutrient_id ?? ""];
    if (!col || col === "glycemicIndex") continue;

    const amount = parseFloat(n.amount ?? "");
    if (!Number.isFinite(amount)) continue;

    const val = normalizeNutrientValue(col, amount);
    (row as Record<string, number | null>)[col] = val;
  }

  return byFood;
}

function sqlVal(v: string | number | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function upsertBatchRaw(rows: NutritionRow[]): Promise<void> {
  if (!rows.length) return;

  const cols = [
    "foodCode",
    "foodGroup",
    "nameEn",
    "nameHi",
    "nameTe",
    "energyKcal",
    "proteinG",
    "totalFatG",
    "carbsG",
    "fiberG",
    "sugarG",
    "ironMg",
    "calciumMg",
    "vitaminAUg",
    "vitaminCMg",
    "folateMg",
    "potassiumMg",
    "sodiumMg",
    "saturatedFatG",
    "magnesiumMg",
    "glycemicIndex",
  ];

  const values = rows
    .map((r) => {
      const fields = [
        r.foodCode,
        r.foodGroup,
        r.nameEn,
        r.nameHi,
        r.nameTe,
        r.energyKcal,
        r.proteinG,
        r.totalFatG,
        r.carbsG,
        r.fiberG,
        r.sugarG,
        r.ironMg,
        r.calciumMg,
        r.vitaminAUg,
        r.vitaminCMg,
        r.folateMg,
        r.potassiumMg,
        r.sodiumMg,
        r.saturatedFatG,
        r.magnesiumMg,
        r.glycemicIndex,
      ];
      return `(${fields.map(sqlVal).join(",")})`;
    })
    .join(",");

  const updates = cols
    .filter((c) => c !== "foodCode")
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(", ");

  await prisma.$executeRawUnsafe(`
    INSERT INTO "NutritionLookup" (${cols.map((c) => `"${c}"`).join(", ")})
    VALUES ${values}
    ON CONFLICT ("foodCode") DO UPDATE SET ${updates}
  `);
}

async function main(): Promise<void> {
  mkdirSync(RAW_DIR, { recursive: true });
  const nutrientMap = loadNutrientIdMap();
  const merged = new Map<number, NutritionRow>();

  for (const ds of DATASETS) {
    const zipPath = join(RAW_DIR, ds.zipName);
    const extractDir = join(RAW_DIR, ds.name);
    await downloadFile(ds.url, zipPath);
    extractZip(zipPath, extractDir);
    const rows = await loadDataset(
      extractDir,
      nutrientMap,
      ds.name === "sr_legacy",
    );
    for (const [code, row] of rows) {
      merged.set(code, row);
    }
    console.log(`${ds.name}: ${rows.size} foods parsed`);
  }

  const all = [...merged.values()];
  console.log(`Total unique foodCode rows: ${all.length}`);

  for (let i = 0; i < all.length; i += BATCH) {
    await upsertBatchRaw(all.slice(i, i + BATCH));
    console.log(`Upserted ${Math.min(i + BATCH, all.length)} / ${all.length}`);
  }

  setUsdaImportBaseline(all.length);
  writeFileSync(BASELINE_FILE, String(all.length));

  writeFileSync(USDA_JSON, JSON.stringify(all));
  writeFileSync(SAMPLE_JSON, JSON.stringify(all.slice(0, 10), null, 2));

  const count = await prisma.nutritionLookup.count();
  console.log(`NutritionLookup count in DB: ${count}`);
  console.log(`Baseline written: ${BASELINE_FILE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
