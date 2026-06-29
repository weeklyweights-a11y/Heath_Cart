"use client";

import type { HealthBadge as BadgeType, ScoreBreakdown } from "@/lib/types";

const styles: Record<
  BadgeType,
  { bg: string; text: string; label: string }
> = {
  recommended: { bg: "bg-[#E8F5E9]", text: "text-[#1B5E20]", label: "Recommended" },
  limit: { bg: "bg-[#FFF3E0]", text: "text-[#E65100]", label: "Limit" },
  avoid: { bg: "bg-[#FFEBEE]", text: "text-[#C62828]", label: "Avoid" },
  neutral: { bg: "bg-gray-100", text: "text-gray-700", label: "Neutral" },
};

interface HealthBadgeProps {
  badge: BadgeType;
  reasoning?: string[];
  scoreBreakdown?: ScoreBreakdown;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function breakdownTip(b?: ScoreBreakdown): string {
  if (!b) return "";
  return `Nutrient ${(b.nutrient * 100).toFixed(0)}% · Graph ${(b.graph * 100).toFixed(0)}% · Semantic ${(b.semantic * 100).toFixed(0)}% · Seasonal ${(b.seasonal * 100).toFixed(0)}%`;
}

export default function HealthBadge({
  badge,
  reasoning = [],
  scoreBreakdown,
  size = "md",
  showLabel = true,
}: HealthBadgeProps) {
  const s = styles[badge];
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : size === "lg" ? "px-4 py-2 text-base" : "px-3 py-1 text-sm";
  const tip = reasoning[0] ?? "";
  const breakdown = breakdownTip(scoreBreakdown);

  return (
    <span className="group relative inline-block">
      <span
        className={`inline-block rounded-full font-semibold ${s.bg} ${s.text} ${pad}`}
      >
        {showLabel ? s.label : badge}
      </span>
      {(tip || breakdown) && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-52 -translate-x-1/2 rounded bg-text px-2 py-1 text-xs text-white group-hover:block group-focus-within:block">
          {tip}
          {breakdown && (
            <>
              {tip ? " " : ""}
              <span className="block mt-1 text-white/80">{breakdown}</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

export function HealthReasoningSection({
  badge,
  reasoning,
}: {
  badge: BadgeType;
  reasoning: string[];
}) {
  const sectionColors: Record<BadgeType, string> = {
    recommended: "border-[#1B5E20] bg-[#E8F5E9]",
    limit: "border-[#E65100] bg-[#FFF3E0]",
    avoid: "border-[#C62828] bg-[#FFEBEE]",
    neutral: "border-gray-400 bg-gray-50",
  };

  if (!reasoning.length) return null;

  return (
    <div className={`rounded-lg border-l-4 p-4 ${sectionColors[badge]}`}>
      <HealthBadge badge={badge} size="lg" />
      <ul className="mt-3 space-y-1 text-sm">
        {reasoning.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
