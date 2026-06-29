/**
 * Download raw grocery product photos (curated Unsplash + Openverse fallback),
 * convert to 400px WebP, verify, and sync catalog + database.
 */
import "./load-env";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { resolve, join } from "path";
import sharp from "sharp";
import { prisma } from "./prisma-client";

const OUT_DIR = resolve(process.cwd(), "public/products");
const SOURCES_PATH = resolve(process.cwd(), "data/products/image-sources.json");
const QUERIES_PATH = resolve(process.cwd(), "data/products/image-queries.json");
const ATTRIBUTIONS_PATH = resolve(process.cwd(), "data/products/image-attributions.json");

const SKIP_TITLE = /\b(shake|smoothie|salad|recipe|cooked|meal|dish|soup|stew|curry|pizza|burger|sandwich|breakfast plate|dinner|restaurant|thanksgiving)\b/i;

interface CatalogItem {
  nameEn: string;
  category: string;
  imageSlug?: string;
  imageUrl?: string;
}

interface OpenverseImage {
  title: string;
  url: string;
  width: number;
  height: number;
  attribution: string;
}

interface ImageAttribution {
  slug: string;
  nameEn: string;
  sourceUrl: string;
  attribution: string;
  source: "unsplash" | "openverse";
}

function slugFor(item: CatalogItem): string {
  return item.imageSlug ?? item.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function defaultQuery(item: CatalogItem): string {
  const base = item.nameEn;
  switch (item.category) {
    case "Vegetables":
      return `${base} fresh raw vegetable produce`;
    case "Fruits":
      return `${base} fresh raw fruit`;
    case "Proteins":
      return `raw ${base} grocery`;
    case "Dairy":
      return `${base} carton package dairy grocery`;
    case "Grains":
      return `${base} package bag grocery`;
    case "Pantry":
      return `${base} bottle jar grocery`;
    case "Snacks":
      return `${base} package grocery snack`;
    default:
      return `${base} grocery product`;
  }
}

async function searchOpenverse(query: string): Promise<OpenverseImage[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: "20",
    license_type: "commercial,modification",
  });

  const res = await fetch(
    `https://api.openverse.engineering/v1/images/?${params.toString()}`,
    { headers: { Accept: "application/json" } },
  );

  if (!res.ok) return [];
  const data = (await res.json()) as { results?: OpenverseImage[] };
  return data.results ?? [];
}

function pickOpenverse(
  candidates: OpenverseImage[],
  slug: string,
  usedUrls: Set<string>,
): OpenverseImage | null {
  const scored = candidates
    .filter((c) => c.url && !usedUrls.has(c.url))
    .filter((c) => c.width >= 280 && c.height >= 280)
    .filter((c) => !SKIP_TITLE.test(c.title ?? ""))
    .map((c) => {
      let score = 0;
      const title = (c.title ?? "").toLowerCase();
      const slugWords = slug.replace(/-/g, " ").split(" ");
      for (const word of slugWords) {
        if (word.length > 2 && title.includes(word)) score += 3;
      }
      if (/\b(fresh|raw|produce|grocery|package|carton|bottle|jar|bag|vegetable|fruit)\b/i.test(title)) {
        score += 2;
      }
      const ratio = c.width / c.height;
      if (ratio >= 0.7 && ratio <= 1.4) score += 1;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.c ?? null;
}

async function downloadAndConvert(
  sourceUrl: string,
  outPath: string,
): Promise<{ width: number; height: number; bytes: number }> {
  const res = await fetch(sourceUrl, {
    headers: { "User-Agent": "HealthCart/1.0 (product image download)" },
  });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 2500) {
    throw new Error(`Image too small (${buffer.length} bytes)`);
  }

  const meta = await sharp(buffer)
    .resize(400, 400, { fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toFile(outPath);

  if (meta.width < 200 || meta.height < 200 || meta.size < 1500) {
    unlinkSync(outPath);
    throw new Error(`Invalid output (${meta.width}x${meta.height}, ${meta.size}B)`);
  }

  return { width: meta.width, height: meta.height, bytes: meta.size };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const curated = JSON.parse(readFileSync(SOURCES_PATH, "utf8")) as Record<string, string>;
  const queries = JSON.parse(readFileSync(QUERIES_PATH, "utf8")) as Record<string, string>;
  const catalogPath = resolve(process.cwd(), "data/products/catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as CatalogItem[];

  const attributions: ImageAttribution[] = [];
  const slugsDone = new Set<string>();
  const usedUrls = new Set<string>();
  const failures: string[] = [];
  let ok = 0;

  for (const item of catalog) {
    const slug = slugFor(item);
    if (slugsDone.has(slug)) continue;
    slugsDone.add(slug);

    const outPath = join(OUT_DIR, `${slug}.webp`);
    let sourceUrl = curated[slug];
    let source: "unsplash" | "openverse" = "unsplash";
    let attribution = "Photo via Unsplash (unsplash.com/license)";

    if (sourceUrl && usedUrls.has(sourceUrl)) {
      sourceUrl = `${sourceUrl}&sig=${slug}`;
    }

    if (!sourceUrl) {
      const query = queries[slug] ?? defaultQuery(item);
      const picked = pickOpenverse(await searchOpenverse(query), slug, usedUrls);
      if (picked) {
        sourceUrl = picked.url;
        source = "openverse";
        attribution = picked.attribution;
      }
    }

    if (!sourceUrl) {
      failures.push(`${slug}: no image source found`);
      continue;
    }

    try {
      const meta = await downloadAndConvert(sourceUrl, outPath);
      usedUrls.add(sourceUrl);

      const imageUrl = `/products/${slug}.webp`;
      item.imageUrl = imageUrl;
      item.imageSlug = slug;

      await prisma.product.updateMany({
        where: { nameEn: item.nameEn },
        data: { imageUrl },
      });

      attributions.push({
        slug,
        nameEn: item.nameEn,
        sourceUrl,
        attribution,
        source,
      });

      ok++;
      console.log(`OK  ${slug} (${meta.bytes}B) [${source}]`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${slug}: ${msg}`);
      console.error(`FAIL ${slug}: ${msg}`);
    }

    await sleep(150);
  }

  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  writeFileSync(ATTRIBUTIONS_PATH, JSON.stringify(attributions, null, 2));

  console.log(`\nDownloaded ${ok}/${slugsDone.size} product images to public/products/`);

  if (failures.length) {
    console.log(`\nFailures (${failures.length}):`);
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
