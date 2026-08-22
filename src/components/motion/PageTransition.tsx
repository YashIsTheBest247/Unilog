"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * A short enter animation on every route change.
 *
 * Keyed on the pathname so React remounts the subtree and the CSS
 * animation replays. Done in CSS rather than with a motion library:
 * this is one keyframe, it runs on the compositor, and it costs nothing
 * in bundle size. `prefers-reduced-motion` is honoured globally.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}

/**
 * A thin progress bar across the top while the next route resolves.
 *
 * Next prefetches aggressively, so most navigations are instant and the
 * bar never appears. It exists for the ones that are not - a cold API
 * route, a slow connection - so a click always produces a visible
 * response.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setActive(true);
    const done = window.setTimeout(() => setActive(false), 620);
    return () => window.clearTimeout(done);
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden"
    >
      <div className="route-progress h-full bg-brand-500" />
    </div>
  );
}
