import { cn } from "@/lib/utils";

/**
 * The Unify wordmark, set as type so it stays crisp at any size and
 * inherits the theme. "uni" carries the accent; "fy" stays neutral.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "select-none font-sans text-[21px] font-extrabold leading-none tracking-[-0.04em]",
        className,
      )}
    >
      <span className="text-brand-500">uni</span>
      <span className="text-mist-100">fy</span>
    </span>
  );
}

export function ProductMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-2.5", className)}>
      <Logo />
      <span
        aria-hidden
        className="h-4 w-px translate-y-[1px] bg-[var(--hairline-strong)]"
      />
      <span className="strapline text-mist-500">Product Intelligence</span>
    </span>
  );
}
