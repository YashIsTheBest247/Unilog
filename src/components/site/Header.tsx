"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { ScrollLink } from "./ScrollLink";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Enrich" },
  { href: "/ask", label: "Ask" },
  { href: "/compare", label: "Compare" },
  { href: "/graph", label: "Graph" },
  { href: "/batch", label: "Batch" },
  { href: "/search", label: "Search Impact" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5">
      {/* A floating pill rather than a full-bleed bar: it keeps the canvas
          visible around it and reads as a control surface, not chrome. */}
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[color-mix(in_srgb,var(--s-card)_88%,transparent)] px-2.5 shadow-[var(--shadow-float)] backdrop-blur-xl transition-shadow sm:h-16 sm:gap-4 sm:px-5">
        <Link
          href="/"
          className="focus-ring flex shrink-0 items-center gap-2.5 rounded-full pr-2"
        >
          <Mark />
          <Logo />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-0.5 md:flex"
        >
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring rounded-full px-4 py-2 text-[15px] font-semibold transition-colors",
                  active
                    ? "tint-2 text-mist-100"
                    : "text-mist-400 tint-hover hover:text-mist-100",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          <ScrollLink
            href="/#console"
            className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-mist-100 px-3.5 py-2.5 text-[14px] font-semibold text-[var(--s-card)] transition-opacity hover:opacity-88 sm:px-5"
          >
            {/* The label is the first thing to go on a narrow phone;
                the arrow alone still reads as the primary action. */}
            <span className="hidden sm:inline">Run enrichment</span>
            <span className="sm:hidden">Enrich</span>
            <Arrow />
          </ScrollLink>
        </div>
      </div>

      {/* The nav collapses on narrow screens; these keep the routes
          reachable without a hamburger and its focus management.

          It carries its own surface rather than sitting on nothing: the
          header is sticky, so a transparent strip lets the page scroll
          visibly through the chips. The right edge fades to signal that
          the row scrolls, since the last item is deliberately clipped. */}
      <div className="relative mx-auto mt-2 max-w-[1400px] md:hidden">
        <nav
          aria-label="Sections"
          className="flex gap-1 overflow-x-auto rounded-full border border-[var(--hairline)] bg-[color-mix(in_srgb,var(--s-card)_92%,transparent)] px-1.5 py-1.5 shadow-[var(--shadow-card)] backdrop-blur-xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-mist-100 text-[var(--s-card)]"
                    : "text-mist-400",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-full bg-gradient-to-l from-[var(--s-card)] to-transparent"
        />
      </div>
    </header>
  );
}

function Mark() {
  return (
    <span
      aria-hidden
      className="grid size-8 place-items-center rounded-full bg-brand-500"
    >
      <svg viewBox="0 0 24 24" className="size-4 text-[var(--on-accent)]">
        <path
          d="M6 6v7a6 6 0 0 0 12 0V6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-3.5", className)}
      aria-hidden
    >
      <path
        d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
