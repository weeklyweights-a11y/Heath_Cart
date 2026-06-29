"use client";

import { useState } from "react";
import ProductImage from "@/components/ui/ProductImage";
import { formatUsd } from "@/lib/format";
import { getBasketItemCopy } from "@/lib/member-labels";
import type { BasketItem as BasketItemType } from "@/lib/types";

interface BasketItemProps {
  item: BasketItemType;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onVariantClick?: () => void;
}

export default function BasketItemRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onVariantClick,
}: BasketItemProps) {
  const [showEvidence, setShowEvidence] = useState(false);
  const variantLabel = `${item.variant.weightValue} ${item.variant.weightUnit}`;
  const { why, sizing } = getBasketItemCopy(item);
  const explanation = item.explanation;

  return (
    <div className="flex gap-3 rounded-lg bg-white p-3 shadow-sm">
      <ProductImage
        src={item.imageUrl}
        alt={item.name}
        className="h-16 w-16 shrink-0 rounded"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-text">{item.name}</h3>
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-400 hover:text-danger"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
        <button
          type="button"
          onClick={onVariantClick}
          className="mt-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-text hover:bg-gray-200"
        >
          {variantLabel}
        </button>
        <p className="mt-2 text-sm text-text/90">
          <span className="font-semibold text-text">Why: </span>
          {why}
        </p>
        {item.membersBenefiting.length > 0 && (
          <p className="mt-1 text-xs text-text/70">
            <span className="font-medium text-text/80">Good for: </span>
            {item.membersBenefiting.join(", ")}
          </p>
        )}
        {sizing && (
          <p className="mt-1 text-xs text-text/60">{sizing}</p>
        )}
        {explanation && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowEvidence((v) => !v)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {showEvidence ? "Hide evidence" : "Show evidence"}
            </button>
            {showEvidence && (
              <div className="mt-1 rounded bg-gray-50 p-2 text-xs text-text/70">
                {explanation.graphPath.length > 0 && (
                  <p>
                    <span className="font-medium">Graph: </span>
                    {explanation.graphPath.join(" → ")}
                  </p>
                )}
                {explanation.scoreBreakdown && (
                  <p className="mt-1">
                    Scores — nutrient: {(explanation.scoreBreakdown.nutrient * 100).toFixed(0)}%,
                    graph: {(explanation.scoreBreakdown.graph * 100).toFixed(0)}%,
                    seasonal: {(explanation.scoreBreakdown.seasonal * 100).toFixed(0)}%
                  </p>
                )}
                {explanation.constraintsChecked.length > 0 && (
                  <p className="mt-1">
                    <span className="font-medium">Checked: </span>
                    {explanation.constraintsChecked.join("; ")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDecrement}
              className="flex h-8 w-8 items-center justify-center rounded border border-primary text-primary"
            >
              −
            </button>
            <span className="min-w-[2rem] text-center font-medium">{item.quantity}</span>
            <button
              type="button"
              onClick={onIncrement}
              className="flex h-8 w-8 items-center justify-center rounded border border-primary text-primary"
            >
              +
            </button>
          </div>
          <span className="font-semibold text-primary">{formatUsd(item.price)}</span>
        </div>
      </div>
    </div>
  );
}
