import "./load-env";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse } from "csv-parse/sync";
import { prisma } from "./prisma-client";
import { resolveUsdaCode } from "./resolve-usda-code";

interface CatalogVariant {
  weightValue: number;
  weightUnit: string;
  price: number;
  sku?: string;
}

interface CatalogProduct {
  nameEn: string;
  category: string;
  subcategory: string;
  description?: string;
  usdaFoodCode?: number | null;
  isSeasonal?: boolean;
  availableMonths?: number[];
  imageSlug?: string;
  variants: CatalogVariant[];
}

function loadCatalog(): CatalogProduct[] {
  const jsonPath = resolve(process.cwd(), "data/products/catalog.json");
  const csvPath = resolve(process.cwd(), "data/products/catalog.csv");

  if (existsSync(jsonPath)) {
    return JSON.parse(readFileSync(jsonPath, "utf8")) as CatalogProduct[];
  }
  if (existsSync(csvPath)) {
    const rows = parse(readFileSync(csvPath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
    }) as Record<string, string>[];
    return rows.map((r) => ({
      nameEn: r.nameEn,
      category: r.category,
      subcategory: r.subcategory,
      description: r.description,
      usdaFoodCode: r.usdaFoodCode ? parseInt(r.usdaFoodCode, 10) : null,
      isSeasonal: r.isSeasonal === "true",
      availableMonths: r.availableMonths
        ? r.availableMonths.split(",").map((m) => parseInt(m.trim(), 10))
        : [],
      variants: JSON.parse(r.variants ?? "[]") as CatalogVariant[],
    }));
  }
  throw new Error("No catalog.json or catalog.csv found");
}

async function main(): Promise<void> {
  const catalog = loadCatalog();
  let resolved = 0;
  let failed: string[] = [];

  for (const item of catalog) {
    let foodCode = item.usdaFoodCode ?? null;
    if (!foodCode) {
      foodCode = await resolveUsdaCode(item.nameEn, item.category);
      if (foodCode) resolved++;
      else failed.push(item.nameEn);
    }

    if (!foodCode) {
      console.warn(`SKIP (no USDA code): ${item.nameEn}`);
      continue;
    }

    const product = await prisma.product.upsert({
      where: {
        nameEn_category: { nameEn: item.nameEn, category: item.category },
      },
      create: {
        nameEn: item.nameEn,
        description: item.description ?? null,
        usdaFoodCode: foodCode,
        category: item.category,
        subcategory: item.subcategory,
        imageUrl: item.imageSlug
          ? `/products/${item.imageSlug}.webp`
          : "/products/default.webp",
        isSeasonal: item.isSeasonal ?? false,
        availableMonths: item.availableMonths ?? [],
        isActive: true,
      },
      update: {
        description: item.description ?? null,
        usdaFoodCode: foodCode,
        subcategory: item.subcategory,
        isSeasonal: item.isSeasonal ?? false,
        availableMonths: item.availableMonths ?? [],
        isActive: true,
      },
    });

    for (const v of item.variants) {
      await prisma.productVariant.upsert({
        where: {
          productId_weightValue_weightUnit: {
            productId: product.id,
            weightValue: v.weightValue,
            weightUnit: v.weightUnit,
          },
        },
        create: {
          productId: product.id,
          weightValue: v.weightValue,
          weightUnit: v.weightUnit,
          price: v.price,
          sku: v.sku ?? null,
        },
        update: {
          price: v.price,
          sku: v.sku ?? null,
        },
      });
    }
  }

  const productCount = await prisma.product.count();
  const variantCount = await prisma.productVariant.count();
  console.log(`Products in DB: ${productCount}, variants: ${variantCount}`);
  console.log(`Auto-resolved USDA codes: ${resolved}`);
  if (failed.length) {
    console.warn(`Failed resolve (${failed.length}):`, failed.slice(0, 10).join(", "));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
