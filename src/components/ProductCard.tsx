"use client";

import Link from "next/link";
import HealthBadge from "@/components/HealthBadge";
import Button from "@/components/ui/Button";
import ProductImage from "@/components/ui/ProductImage";
import { formatUsd } from "@/lib/format";
import type { HealthBadge as BadgeType, ProductDto } from "@/lib/types";

interface ProductCardProps {
  product: ProductDto;
  familyId?: string;
  basketQty?: number;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

export default function ProductCard({
  product,
  familyId,
  basketQty = 0,
  onAdd,
  onIncrement,
  onDecrement,
}: ProductCardProps) {
  const href = familyId
    ? `/product/${product.id}?familyId=${familyId}`
    : `/product/${product.id}`;

  return (
    <article className="flex flex-col rounded-lg bg-white p-3 shadow-sm transition hover:shadow-md">
      <Link href={href} className="relative mb-3 block aspect-square overflow-hidden rounded">
        <ProductImage
          src={product.imageUrl}
          alt={product.nameEn}
          fill
          className="rounded"
          sizes="(max-width:768px) 50vw, 25vw"
        />
      </Link>
      {product.badge && (
        <div className="mb-2">
          <HealthBadge
            badge={product.badge as BadgeType}
            reasoning={product.reasoning}
            scoreBreakdown={product.scoreBreakdown}
            size="sm"
          />
        </div>
      )}
      <Link href={href}>
        <h3 className="line-clamp-2 font-medium text-text">{product.nameEn}</h3>
      </Link>
      <p className="mt-1 font-semibold text-primary">
        {formatUsd(product.price)}
        {product.priceVariantLabel ? (
          <span className="ml-1 text-sm font-normal text-text/60">
            / {product.priceVariantLabel}
          </span>
        ) : null}
      </p>
      <div className="mt-auto pt-3">
        {basketQty > 0 && onIncrement && onDecrement ? (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onDecrement}
              className="flex h-10 w-10 items-center justify-center rounded border border-primary text-primary"
            >
              −
            </button>
            <span className="font-medium">{basketQty}</span>
            <button
              type="button"
              onClick={onIncrement}
              className="flex h-10 w-10 items-center justify-center rounded border border-primary text-primary"
            >
              +
            </button>
          </div>
        ) : onAdd ? (
          <Button variant="secondary" className="w-full" onClick={onAdd}>
            Add to basket
          </Button>
        ) : null}
      </div>
    </article>
  );
}
