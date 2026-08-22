"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProductMark } from "./Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Enrich" },
  { href: "/batch", label: "Batch" },
  { href: "/search", label: "Search Impact" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_78%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-5 sm:px-8">
        <Link href="/" className="focus-ring rounded-md">
          <ProductMark />
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring relative rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "text-mist-100"
                    : "text-mist-400 hover:text-mist-200",
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brand-500" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 rounded-full border border-[var(--hairline)] bg-[color-mix(in_srgb,var(--color-ink-800)_50%,transparent)] px-3 py-1.5 sm:flex">
          <span className="size-1.5 rounded-full bg-verify-400 shadow-[0_0_10px_var(--color-verify-400)]" />
          <span className="font-mono text-[11px] tracking-wide text-mist-300">
            UniHack 2026
          </span>
        </div>
      </div>
    </header>
  );
}
