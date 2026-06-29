"use client";

import ProductCard from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import type { ProductDto } from "@/lib/types";

interface ProductGridProps {
  products: ProductDto[];
  familyId?: string;
  loading?: boolean;
  getBasketQty: (id: string) => number;
  onAdd?: (product: ProductDto) => void;
  onIncrement?: (product: ProductDto) => void;
  onDecrement?: (product: ProductDto) => void;
}

export default function ProductGrid({
  products,
  familyId,
  loading,
  getBasketQty,
  onAdd,
  onIncrement,
  onDecrement,
}: ProductGridProps) {
  if (loading) return <ProductGridSkeleton />;

  if (!products.length) {
    return (
      <p className="py-12 text-center text-text/70">
        No products found. Try adjusting your filters.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          familyId={familyId}
          basketQty={getBasketQty(p.id)}
          onAdd={onAdd ? () => onAdd(p) : undefined}
          onIncrement={onIncrement ? () => onIncrement(p) : undefined}
          onDecrement={onDecrement ? () => onDecrement(p) : undefined}
        />
      ))}
    </div>
  );
}
