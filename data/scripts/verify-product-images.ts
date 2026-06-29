/**
 * Verify every catalog product has a valid WebP image on disk.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import sharp from "sharp";

interface CatalogItem {
  nameEn: string;
  imageSlug?: string;
  imageUrl?: string;
}

async function main(): Promise<void> {
  const catalog = JSON.parse(
    readFileSync(resolve(process.cwd(), "data/products/catalog.json"), "utf8"),
  ) as CatalogItem[];

  const outDir = resolve(process.cwd(), "public/products");
  const slugs = new Set<string>();
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const item of catalog) {
    const slug =
      item.imageSlug ?? item.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (slugs.has(slug)) continue;
    slugs.add(slug);

    const path = join(outDir, `${slug}.webp`);
    if (!existsSync(path)) {
      missing.push(slug);
      continue;
    }

    try {
      const meta = await sharp(path).metadata();
      if (!meta.width || !meta.height || meta.width < 100) {
        invalid.push(`${slug}: bad dimensions ${meta.width}x${meta.height}`);
      }
    } catch {
      invalid.push(`${slug}: corrupt webp`);
    }
  }

  console.log(`Checked ${slugs.size} product slugs in public/products/`);

  if (missing.length) {
    console.error(`Missing (${missing.length}): ${missing.join(", ")}`);
  }
  if (invalid.length) {
    console.error(`Invalid (${invalid.length}):`);
    invalid.forEach((i) => console.error(`  ${i}`));
  }

  if (!missing.length && !invalid.length) {
    console.log("All product images verified.");
  } else {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
