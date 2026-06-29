/**
 * Generate raw grocery product photos with Gemini (gemini-2.5-flash-image),
 * save as WebP in public/products/, and sync catalog + database.
 *
 * Usage:
 *   npm run generate:images              # all missing slugs
 *   npm run generate:images -- --slug=kale
 *   npm run generate:images -- --force   # regenerate all
 *   npm run generate:images -- --limit=5
 */
import "./load-env";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { prisma } from "./prisma-client";

const OUT_DIR = resolve(process.cwd(), "public/products");
const MODEL = "gemini-2.5-flash-image";

interface CatalogItem {
  nameEn: string;
  category: string;
  imageSlug?: string;
  imageUrl?: string;
}

function slugFor(item: CatalogItem): string {
  return item.imageSlug ?? item.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function buildPrompt(item: CatalogItem): string {
  const { nameEn, category } = item;
  const base =
    "Photorealistic studio product photo for an American grocery e-commerce site. " +
    "Show ONLY the raw grocery item itself — not a cooked dish, not a meal, not a recipe, " +
    "not a restaurant plate. Clean soft white background, natural daylight, sharp focus, " +
    "single product centered, square composition.";

  switch (category) {
    case "Vegetables":
    case "Fruits":
      return `${base} Fresh raw ${nameEn} produce as sold loose or in a simple produce section. Whole uncut ingredient, realistic colors and texture.`;
    case "Proteins":
      if (/canned|tuna/i.test(nameEn)) {
        return `${base} A single ${nameEn} can/package on white background, supermarket packaging, label visible.`;
      }
      if (/egg/i.test(nameEn)) {
        return `${base} A standard grocery carton of ${nameEn}, front-facing product shot.`;
      }
      return `${base} Raw ${nameEn} as packaged in a US grocery store (tray, wrap, or butcher pack). Uncooked meat/seafood/legumes only.`;
    case "Dairy":
      return `${base} ${nameEn} dairy product in typical US supermarket packaging (carton, tub, or wrap). Front product shot.`;
    case "Grains":
      return `${base} ${nameEn} in standard US grocery packaging (bag or box). Front-facing package shot.`;
    case "Pantry":
      return `${base} ${nameEn} in a typical US grocery jar, bottle, carton, or can. Front product shot, label visible.`;
    case "Snacks":
      return `${base} ${nameEn} snack in standard US grocery retail packaging. Front product shot.`;
    default:
      return `${base} ${nameEn} grocery product, front-facing package shot.`;
  }
}

function parseArgs(): { slug?: string; force: boolean; limit?: number } {
  const args = process.argv.slice(2);
  let slug: string | undefined;
  let force = false;
  let limit: number | undefined;

  for (const arg of args) {
    if (arg === "--force") force = true;
    else if (arg.startsWith("--slug=")) slug = arg.slice("--slug=".length);
    else if (arg.startsWith("--limit=")) limit = parseInt(arg.slice("--limit=".length), 10);
  }

  return { slug, force, limit };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function generateImage(
  ai: GoogleGenAI,
  prompt: string,
): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }

  throw new Error("Gemini returned no image data");
}

async function saveWebp(buffer: Buffer, outPath: string): Promise<number> {
  const meta = await sharp(buffer)
    .resize(400, 400, { fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toFile(outPath);

  if (meta.size < 1500) {
    throw new Error(`Output too small (${meta.size} bytes)`);
  }
  return meta.size;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in .env.local");
    process.exit(1);
  }

  const { slug: onlySlug, force, limit } = parseArgs();
  mkdirSync(OUT_DIR, { recursive: true });

  const catalogPath = resolve(process.cwd(), "data/products/catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as CatalogItem[];
  const ai = new GoogleGenAI({ apiKey });

  const slugsDone = new Set<string>();
  const targets: { slug: string; item: CatalogItem }[] = [];

  for (const item of catalog) {
    const slug = slugFor(item);
    if (slugsDone.has(slug)) continue;
    slugsDone.add(slug);
    if (onlySlug && slug !== onlySlug) continue;

    const outPath = join(OUT_DIR, `${slug}.webp`);
    if (!force && existsSync(outPath)) continue;

    targets.push({ slug, item });
  }

  const batch = limit ? targets.slice(0, limit) : targets;
  console.log(`Generating ${batch.length} images with ${MODEL}…`);

  const failures: string[] = [];
  let ok = 0;

  for (const { slug, item } of batch) {
    const outPath = join(OUT_DIR, `${slug}.webp`);
    const prompt = buildPrompt(item);

    try {
      console.log(`→ ${slug} (${item.nameEn})`);
      const buffer = await generateImage(ai, prompt);
      const bytes = await saveWebp(buffer, outPath);

      const imageUrl = `/products/${slug}.webp`;
      item.imageUrl = imageUrl;
      item.imageSlug = slug;

      await prisma.product.updateMany({
        where: { nameEn: item.nameEn },
        data: { imageUrl },
      });

      ok++;
      console.log(`  OK ${bytes}B`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${slug}: ${msg}`);
      console.error(`  FAIL: ${msg}`);
    }

    await sleep(2000);
  }

  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log(`\nGenerated ${ok}/${batch.length} images in public/products/`);

  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
