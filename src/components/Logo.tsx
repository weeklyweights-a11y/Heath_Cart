"use client";

import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-primary">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <circle cx="14" cy="14" r="14" fill="#1B5E20" opacity="0.15" />
        <path
          d="M14 6c-2 4-6 5-6 9a6 6 0 0012 0c0-4-4-5-6-9z"
          fill="#1B5E20"
        />
      </svg>
      <span className="font-heading text-xl font-bold">HealthCart</span>
    </Link>
  );
}
