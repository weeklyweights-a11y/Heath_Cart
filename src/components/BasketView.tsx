"use client";

import { useEffect, useMemo, useState } from "react";
import CoverageGauge from "@/components/CoverageScore";
import WeeklyContext from "@/components/WeeklyContext";
import BasketItemRow from "@/components/ui/BasketItem";
import Button from "@/components/ui/Button";
import { useHealthCart } from "@/context/HealthCartContext";
import {
  adjustBasket,
  fetchProduct,
  generateBasket,
} from "@/lib/api-client";
import { CATEGORIES } from "@/lib/constants";
import { formatUsd } from "@/lib/format";
import {
  formatBudgetTradeoff,
  formatMemberCoverageLabel,
} from "@/lib/member-labels";
import type { BasketItem } from "@/lib/types";

export default function BasketView() {
  const {
    familyId,
    family,
    basket,
    basketId,
    setBasket,
    setChatOpen,
    extractedContext,
  } = useHealthCart();
  const [budget, setBudget] = useState("");
  const [tradeoffMsg, setTradeoffMsg] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function ensureBasket() {
      if (basket?.items.length) return;
      if (!familyId) return;
      setLoading(true);
      const stored =
        typeof window !== "undefined"
          ? sessionStorage.getItem("healthcart_basketId")
          : null;
      if (stored) {
        const { data } = await import("@/lib/api-client").then((m) =>
          m.fetchBasket(stored),
        );
        if (data?.items.length) {
          setBasket(data);
          setLoading(false);
          return;
        }
      }
      const { data } = await generateBasket({ familyId });
      if (data) setBasket(data);
      setLoading(false);
    }
    ensureBasket();
  }, [familyId, basket, setBasket]);

  const grouped = useMemo(() => {
    if (!basket) return new Map<string, BasketItem[]>();
    const map = new Map<string, BasketItem[]>();
    for (const item of basket.items) {
      const cat = item.category ?? "Pantry";
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    return map;
  }, [basket]);

  const memberBars = useMemo(() => {
    if (!basket || !family) return [];
    return family.members.map((m) => ({
      label: formatMemberCoverageLabel(
        m,
        basket.perMemberCoverage[m.name] ?? 0,
        extractedContext,
      ),
      value: basket.perMemberCoverage[m.name] ?? 0,
    }));
  }, [basket, family, extractedContext]);

  const handleAdjust = async (
    productId: string,
    newQuantity: number | "remove",
  ) => {
    if (!familyId || !basketId) return;
    const { data } = await adjustBasket({
      familyId,
      basketId,
      adjustments: [{ productId, newQuantity }],
    });
    if (data) setBasket(data);
  };

  const handleBudget = async () => {
    if (!familyId || !budget) return;
    const before = basket?.coverageScore ?? 0;
    setLoading(true);
    const { data } = await generateBasket({
      familyId,
      budget: parseFloat(budget),
    });
    setLoading(false);
    if (data) {
      setBasket(data);
      setTradeoffMsg(
        formatBudgetTradeoff(
          parseFloat(budget),
          data.coverageScore,
          before,
          data.coverageTradeoff,
        ),
      );
    }
  };

  if (!familyId) {
    return (
      <p className="text-center text-text/70">
        Set up your family first to build a basket.
      </p>
    );
  }

  if (!basket && loading) {
    return <p className="text-center">Loading basket...</p>;
  }

  if (!basket?.items.length) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p>
          Chat with our assistant about your family&apos;s week and we&apos;ll
          build your perfect basket
        </p>
        <Button onClick={() => setChatOpen(true)}>Open Chat</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-primary">Your Weekly Groceries</h1>
        <WeeklyContext summary={basket.weeklyContext} />
      </div>

      <CoverageGauge overall={basket.coverageScore} perMember={memberBars} />

      {CATEGORIES.map((cat) => {
        const items = grouped.get(cat);
        if (!items?.length) return null;
        return (
          <section key={cat}>
            <h2 className="mb-3 text-xl text-primary">{cat}</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <BasketItemRow
                  key={item.productId}
                  item={item}
                  onIncrement={() =>
                    handleAdjust(item.productId, item.quantity + 1)
                  }
                  onDecrement={() =>
                    item.quantity > 1
                      ? handleAdjust(item.productId, item.quantity - 1)
                      : handleAdjust(item.productId, "remove")
                  }
                  onRemove={() => handleAdjust(item.productId, "remove")}
                  onVariantClick={async () => {
                    if (!familyId) return;
                    const { data: product } = await fetchProduct(
                      item.productId,
                      familyId,
                    );
                    if (!product?.variants?.[1]) return;
                    await handleAdjust(item.productId, "remove");
                    const { addToBasket } = await import("@/lib/api-client");
                    const { data } = await addToBasket({
                      familyId,
                      basketId: basketId ?? undefined,
                      productId: item.productId,
                      variantId: product.variants[1].id,
                      quantity: item.quantity,
                    });
                    if (data) setBasket(data);
                  }}
                />
              ))}
            </div>
          </section>
        );
      })}

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <p className="text-2xl font-bold text-primary">
          Total: {formatUsd(basket.totalPrice)}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Set a budget: $
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="ml-1 w-24 rounded border border-primary/20 px-2 py-1"
            />
          </label>
          <Button variant="secondary" onClick={handleBudget} loading={loading}>
            Re-optimize
          </Button>
        </div>
        {tradeoffMsg && (
          <p className="mt-3 text-sm text-text/80">{tradeoffMsg}</p>
        )}
      </div>

      <Button className="w-full" onClick={() => setShowConfirm(true)}>
        Looks Good
      </Button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
            <p className="text-lg text-text">
              Your basket covers {basket.coverageScore}% of your family&apos;s
              weekly nutritional needs across {basket.items.length} items for{" "}
              {formatUsd(basket.totalPrice)}. You&apos;re all set for the week!
            </p>
            <Button className="mt-4 w-full" onClick={() => setShowConfirm(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
