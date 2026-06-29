"use client";

import { useState } from "react";
import type { FamilyMemberDto } from "@/lib/types";

interface NutritionRow {
  label: string;
  key: string;
  unit: string;
  highlight?: boolean;
}

export default function NutritionInfo({
  nutrition,
  family,
}: {
  nutrition: Record<string, number | null> | null;
  family: FamilyMemberDto[] | null;
}) {
  const [open, setOpen] = useState(false);

  const hasCholesterol = family?.some((m) =>
    m.conditions.some((c) => c.includes("cholesterol")),
  );
  const hasAnemia = family?.some((m) =>
    m.conditions.some((c) => c.includes("anemia")),
  );

  if (!nutrition) return null;

  const rows: NutritionRow[] = [
    { label: "Energy", key: "energyKcal", unit: "kcal" },
    { label: "Protein", key: "proteinG", unit: "g" },
    { label: "Carbs", key: "carbsG", unit: "g" },
    { label: "Fat", key: "totalFatG", unit: "g" },
    { label: "Fiber", key: "fiberG", unit: "g", highlight: hasCholesterol },
    { label: "Iron", key: "ironMg", unit: "mg", highlight: hasAnemia },
    { label: "Calcium", key: "calciumMg", unit: "mg" },
    { label: "Vitamin C", key: "vitaminCMg", unit: "mg" },
    { label: "Folate", key: "folateMg", unit: "mg" },
  ];

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-primary"
      >
        Nutrition (per 100g) — USDA FoodData Central
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-primary/10 px-4 py-3">
          <p className="mb-2 text-xs text-text/60">USDA FoodData Central</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {rows.map(({ label, key, unit, highlight }) => {
              const val = nutrition[key];
              if (val == null) return null;
              return (
                <div
                  key={key}
                  className={`rounded px-2 py-1 ${
                    highlight ? "bg-[#E8F5E9] font-semibold" : ""
                  }`}
                >
                  <dt className="text-text/70">{label}</dt>
                  <dd>
                    {val} {unit}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </div>
  );
}
