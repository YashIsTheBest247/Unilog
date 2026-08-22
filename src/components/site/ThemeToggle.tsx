"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

/**
 * Applied before paint by an inline script in the document head, so the
 * page never flashes the wrong theme. This component only keeps the
 * button in sync with what that script already decided.
 */
export const THEME_INIT = `(function(){try{var t=localStorage.getItem('ui-theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme) ?? "light";
    setTheme(current);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ui-theme", next);
    } catch {
      // A blocked storage API is not a reason to refuse the toggle.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        mounted
          ? `Switch to ${theme === "dark" ? "light" : "dark"} theme`
          : "Switch theme"
      }
      className="focus-ring grid size-9 shrink-0 place-items-center rounded-full border border-[var(--hairline)] text-mist-300 transition-colors tint-hover hover:text-mist-100"
    >
      {/* Both glyphs are rendered; CSS picks one, so there is nothing to
          hydrate and no flash of the wrong icon. */}
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <g className="hidden [:root[data-theme='dark']_&]:block">
          <circle cx="12" cy="12" r="4.2" fill="currentColor" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="12"
              y1="2.6"
              x2="12"
              y2="5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
        </g>
        <path
          className="block [:root[data-theme='dark']_&]:hidden"
          d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
