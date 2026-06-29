"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProductGrid from "@/components/ProductGrid";
import { useHealthCart } from "@/context/HealthCartContext";
import { addToBasket, adjustBasket, fetchProducts } from "@/lib/api-client";
import { CATEGORIES } from "@/lib/constants";
import type { HealthBadge, ProductDto } from "@/lib/types";

export default function ShopPageClient() {
  const {
    familyId,
    scoreMap,
    scoresVersion,
    getBasketQty,
    setBasket,
    basketId,
    ensureFamilyForShopping,
  } = useHealthCart();
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchProducts({
      familyId: familyId ?? undefined,
      category: category || undefined,
      search: debouncedSearch || undefined,
      limit: 100,
    });
    setLoading(false);
    if (data) setProducts(data.products);
  }, [familyId, category, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load, scoresVersion]);

  const displayProducts = useMemo(() => {
    const merged = products.map((p) => {
      const s = scoreMap.get(p.id);
      if (!s) return p;
      return {
        ...p,
        score: s.score,
        badge: s.badge as HealthBadge,
        reasoning: s.reasoning,
      };
    });
    if (familyId && scoreMap.size) {
      return [...merged].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }
    return merged;
  }, [products, scoreMap, familyId]);

  const handleAdd = async (product: ProductDto) => {
    const fid = familyId ?? (await ensureFamilyForShopping());
    if (!fid) return;
    const res = await fetch(`/api/products/${product.id}`);
    const json = await res.json();
    const variant = json.data?.variants?.[0];
    if (!variant) return;
    const { data } = await addToBasket({
      familyId: fid,
      basketId: basketId ?? undefined,
      productId: product.id,
      variantId: variant.id,
    });
    if (data) setBasket(data);
  };

  const handleQtyChange = async (product: ProductDto, delta: number) => {
    const fid = familyId ?? (await ensureFamilyForShopping());
    if (!fid) return;
    let activeBasketId = basketId;
    if (!activeBasketId) {
      await handleAdd(product);
      return;
    }
    const qty = getBasketQty(product.id) + delta;
    if (qty <= 0) {
      const { data } = await adjustBasket({
        familyId: fid,
        basketId: activeBasketId,
        adjustments: [{ productId: product.id, newQuantity: "remove" }],
      });
      if (data) setBasket(data);
    } else {
      const { data } = await adjustBasket({
        familyId: fid,
        basketId: activeBasketId,
        adjustments: [{ productId: product.id, newQuantity: qty }],
      });
      if (data) setBasket(data);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-primary">Shop</h1>
      {!familyId && (
        <p className="rounded-lg bg-white p-4 text-sm text-text/80">
          Add items anytime — set up your family on the Family page for personalized
          health badges and smarter recommendations.
        </p>
      )}
      <input
        type="search"
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-primary/20 px-4 py-3"
      />
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={`shrink-0 rounded-full px-4 py-2 text-sm ${
            !category ? "bg-primary text-white" : "bg-white text-text"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${
              category === c ? "bg-primary text-white" : "bg-white text-text"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <ProductGrid
        products={displayProducts}
        familyId={familyId ?? undefined}
        loading={loading}
        getBasketQty={getBasketQty}
        onAdd={handleAdd}
        onIncrement={(p) => handleQtyChange(p, 1)}
        onDecrement={(p) => handleQtyChange(p, -1)}
      />
    </div>
  );
}
