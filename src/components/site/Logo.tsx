import { cn } from "@/lib/utils";

/**
 * Unilog wordmark, rebuilt as type so it stays crisp at any size and
 * inherits the theme. "uni" carries the electric blue; "log" stays neutral.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "select-none font-sans text-[22px] font-extrabold leading-none tracking-[-0.035em]",
        className,
      )}
    >
      <span className="text-brand-500">uni</span>
      <span className="text-mist-100">log</span>
    </span>
  );
}

export function ProductMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-2", className)}>
      <Logo />
      <span
        aria-hidden
        className="h-4 w-px translate-y-[1px] bg-[var(--hairline-strong)]"
      />
      <span className="text-[13px] font-semibold tracking-[0.14em] text-mist-300 uppercase">
        Product Intelligence
      </span>
    </span>
  );
}
