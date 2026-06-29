"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HealthReasoningSection } from "@/components/HealthBadge";
import NutritionInfo from "@/components/NutritionInfo";
import Tag from "@/components/ui/Tag";
import Button from "@/components/ui/Button";
import ProductImage from "@/components/ui/ProductImage";
import { useHealthCart } from "@/context/HealthCartContext";
import { addToBasket, fetchProduct, type ProductDetail } from "@/lib/api-client";
import { formatUsd } from "@/lib/format";
import type { HealthBadge } from "@/lib/types";

export default function ProductDetailClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const urlFamilyId = searchParams.get("familyId");
  const { familyId: ctxFamilyId, family, basketId, setBasket } = useHealthCart();
  const familyId = urlFamilyId ?? ctxFamilyId;
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [variantId, setVariantId] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchProduct(id, familyId ?? undefined).then(({ data }) => {
      if (data) {
        setProduct(data);
        setVariantId(data.variants[0]?.id ?? "");
      }
    });
  }, [id, familyId]);

  const selectedVariant = product?.variants.find((v) => v.id === variantId);

  const handleAdd = async () => {
    if (!familyId || !variantId) return;
    setAdding(true);
    const { data, error } = await addToBasket({
      familyId,
      basketId: basketId ?? undefined,
      productId: id,
      variantId,
    });
    setAdding(false);
    if (data) {
      setBasket(data);
      setToast("Added to basket!");
      setTimeout(() => setToast(null), 2000);
    } else if (error) setToast(error);
  };

  if (!product) {
    return <p className="text-center">Loading...</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-white shadow-sm">
        <ProductImage
          src={product.imageUrl}
          alt={product.nameEn}
          fill
          className="rounded-xl"
          sizes="(max-width:1024px) 100vw, 50vw"
        />
      </div>
      <div className="space-y-6">
        <h1 className="text-3xl text-primary">{product.nameEn}</h1>
        <div className="flex flex-wrap gap-2">
          {product.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVariantId(v.id)}
              className={`rounded-full px-4 py-2 text-sm ${
                variantId === v.id
                  ? "bg-primary text-white"
                  : "bg-white border border-primary/20"
              }`}
            >
              {v.weightValue} {v.weightUnit} — {formatUsd(v.price)}
            </button>
          ))}
        </div>
        {product.badge && product.reasoning && (
          <HealthReasoningSection
            badge={product.badge as HealthBadge}
            reasoning={product.reasoning}
          />
        )}
        <div className="flex flex-wrap gap-2">
          {product.tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </div>
        <NutritionInfo
          nutrition={product.nutrition as Record<string, number | null>}
          family={family?.members ?? null}
        />
        <p className="text-2xl font-bold text-primary">
          {formatUsd(selectedVariant?.price ?? product.price)}
        </p>
        <Button
          onClick={handleAdd}
          loading={adding}
          disabled={!familyId}
          className="w-full"
        >
          Add to Basket
        </Button>
        {toast && <p className="text-sm text-primary">{toast}</p>}
        {!familyId && (
          <p className="text-sm text-text/70">Set up your family to add items.</p>
        )}
      </div>
    </div>
  );
}
