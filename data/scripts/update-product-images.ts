/**
 * Generate WebP product images from catalog imageSlug entries.
 * Uses sharp to create 400px-wide placeholder images with category color bands.
 */
import "./load-env";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import sharp from "sharp";
import { prisma } from "./prisma-client";

const OUT_DIR = resolve(process.cwd(), "public/products");

const CATEGORY_COLORS: Record<string, string> = {
  Vegetables: "#4CAF50",
  Fruits: "#FF9800",
  Proteins: "#795548",
  Grains: "#8D6E63",
  Dairy: "#FFF8E1",
  Pantry: "#5D4037",
  Snacks: "#1B5E20",
  default: "#1B5E20",
};

interface CatalogItem {
  nameEn: string;
  category: string;
  imageSlug?: string;
  imageUrl?: string;
}

async function renderWebp(
  slug: string,
  label: string,
  category: string,
): Promise<string> {
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
  const svg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="300" fill="${color}"/>
    <rect y="220" width="400" height="80" fill="rgba(0,0,0,0.35)"/>
    <text x="200" y="260" font-family="Arial,sans-serif" font-size="18" fill="white" text-anchor="middle">${label.replace(/&/g, "&amp;").slice(0, 28)}</text>
  </svg>`;

  const outPath = join(OUT_DIR, `${slug}.webp`);
  await sharp(Buffer.from(svg)).resize(400).webp({ quality: 82 }).toFile(outPath);
  return `/products/${slug}.webp`;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const catalogPath = resolve(process.cwd(), "data/products/catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as CatalogItem[];

  const slugsDone = new Set<string>();

  for (const item of catalog) {
    const slug = item.imageSlug ?? item.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (slugsDone.has(slug)) continue;
    slugsDone.add(slug);

    const url = await renderWebp(slug, item.nameEn, item.category);
    item.imageUrl = url;
    item.imageSlug = slug;

    await prisma.product.updateMany({
      where: { nameEn: item.nameEn },
      data: { imageUrl: url },
    });
  }

  for (const [cat, color] of Object.entries(CATEGORY_COLORS)) {
    if (cat === "default") continue;
    const slug = `category-${cat.toLowerCase()}`;
    if (!existsSync(join(OUT_DIR, `${slug}.webp`))) {
      await renderWebp(slug, cat, cat);
    }
  }

  if (!existsSync(join(OUT_DIR, "default.webp"))) {
    await renderWebp("default", "HealthCart", "default");
  }

  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log(`Generated ${slugsDone.size} product WebP images in public/products/`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
