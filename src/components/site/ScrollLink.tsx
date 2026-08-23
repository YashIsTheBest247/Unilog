"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * A link to an anchor that still works the second time you click it.
 *
 * A plain hash link is a navigation, and once the URL already carries
 * that hash the browser correctly decides there is nothing to navigate
 * to — so the click does nothing. That is fine for a table of contents
 * and useless for a call to action someone will press repeatedly after
 * scrolling back up.
 *
 * When the target is already on this page, this scrolls to it directly
 * and rewrites the hash without a navigation. Off-page, it falls back to
 * an ordinary route change, so `/#console` from `/graph` still works.
 */
export function ScrollLink({
  href,
  onClick,
  ...rest
}: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname();

  const [path, hash] = href.split("#");
  const samePage = !path || path === pathname || path === "/" + pathname;

  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !hash || !samePage) return;

        const target = document.getElementById(hash);
        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });

        // Keep the address bar honest without triggering a navigation,
        // which is what made the repeat click a no-op to begin with.
        window.history.replaceState(null, "", `#${hash}`);
      }}
      {...rest}
    />
  );
}
