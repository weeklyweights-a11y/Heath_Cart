"use client";

import { useEffect, useState } from "react";

function gaugeColor(pct: number) {
  if (pct >= 70) return "#1B5E20";
  if (pct >= 50) return "#E65100";
  return "#C62828";
}

interface CoverageGaugeProps {
  overall: number;
  perMember: { label: string; value: number }[];
}

export default function CoverageGauge({ overall, perMember }: CoverageGaugeProps) {
  const [animated, setAnimated] = useState(0);
  const r = 54;
  const c = 2 * Math.PI * r;
  const color = gaugeColor(overall);

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(overall));
    return () => cancelAnimationFrame(t);
  }, [overall]);

  const offset = c - (animated / 100) * c;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#eee" strokeWidth="12" />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <p className="-mt-20 text-3xl font-bold" style={{ color }}>
          {overall}%
        </p>
        <p className="mt-8 text-sm text-text/70">Weekly nutritional coverage</p>
      </div>
      <div className="mt-6 space-y-3">
        {perMember.map(({ label, value }) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-text">{label}</span>
              <span className="font-medium" style={{ color: gaugeColor(value) }}>
                {value}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${value}%`, backgroundColor: gaugeColor(value) }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
