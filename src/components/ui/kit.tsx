import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- Button */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "amber";
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-all duration-200 disabled:pointer-events-none disabled:opacity-45",
        size === "sm" && "px-3.5 py-1.5 text-[13px]",
        size === "md" && "px-5 py-2.5 text-sm",
        size === "lg" && "px-7 py-3.5 text-[15px]",
        variant === "primary" &&
          "bg-brand-500 text-ink-950 shadow-[0_6px_24px_-6px_var(--color-brand-500)] hover:bg-brand-400 hover:shadow-[0_8px_30px_-6px_var(--color-brand-400)] active:translate-y-px",
        variant === "amber" &&
          "bg-amber-500 text-ink-950 shadow-[0_6px_24px_-8px_var(--color-amber-500)] hover:bg-amber-400 active:translate-y-px",
        variant === "outline" &&
          "border border-[var(--hairline-strong)] text-mist-100 hover:border-brand-500 hover:bg-[color-mix(in_srgb,var(--color-brand-500)_10%,transparent)]",
        variant === "ghost" && "text-mist-300 hover:bg-white/5 hover:text-mist-100",
        className,
      )}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------- Badge */
const TONES = {
  brand: "border-brand-500/35 bg-brand-500/12 text-brand-300",
  verify: "border-verify-400/35 bg-verify-400/12 text-verify-400",
  amber: "border-amber-500/35 bg-amber-500/12 text-amber-400",
  reject: "border-reject-400/35 bg-reject-400/12 text-reject-400",
  neutral: "border-[var(--hairline)] bg-white/[0.04] text-mist-300",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] leading-5 font-medium tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Panel */
export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel", className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  hint,
  right,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="hair-x flex items-center gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <h3 className="truncate text-[13px] font-bold tracking-[0.1em] text-mist-200 uppercase">
          {title}
        </h3>
        {hint && <p className="mt-0.5 truncate text-xs text-mist-500">{hint}</p>}
      </div>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Meter */
export function Meter({
  value,
  tone = "brand",
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const bar =
    tone === "verify"
      ? "bg-verify-400"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "reject"
          ? "bg-reject-400"
          : "bg-brand-500";
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]",
        className,
      )}
      role="meter"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", bar)}
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- Eyebrow */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-[11px] font-medium tracking-[0.22em] text-brand-400 uppercase">
      {children}
    </p>
  );
}
