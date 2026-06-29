"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ChatPanel from "@/components/ChatPanel";
import Logo from "@/components/Logo";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/basket", label: "Basket" },
  { href: "/family", label: "Family" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="min-h-screen bg-cream">
      {!isHome && (
        <header className="sticky top-0 z-30 border-b border-primary/10 bg-cream/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Logo />
            <nav className="flex gap-1 sm:gap-4">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`rounded px-3 py-2 text-sm font-medium transition ${
                    pathname.startsWith(href)
                      ? "bg-primary text-white"
                      : "text-primary hover:bg-primary/10"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
      )}
      <main
        className={`mx-auto max-w-6xl px-4 pb-24 ${isHome ? "pt-0" : "py-6"}`}
      >
        {children}
      </main>
      <ChatPanel />
    </div>
  );
}
