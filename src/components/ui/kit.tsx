import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- Button */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "ghost" | "outline" | "amber";
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-all duration-200 disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "px-4 py-2 text-[13px]",
        size === "md" && "px-5 py-2.5 text-sm",
        size === "lg" && "px-7 py-3.5 text-[15px]",
        // Solid neutral is the default call to action, the way the
        // reference does it — the accent is reserved for meaning.
        variant === "primary" &&
          "bg-mist-100 text-[var(--s-card)] hover:opacity-88 active:translate-y-px",
        variant === "accent" &&
          "bg-brand-500 text-[var(--on-accent)] hover:bg-brand-400 active:translate-y-px",
        variant === "amber" &&
          "bg-amber-500 text-[var(--on-accent)] hover:opacity-90 active:translate-y-px",
        variant === "outline" &&
          "border border-[var(--hairline-strong)] text-mist-100 hover:border-mist-300 tint-hover",
        variant === "ghost" && "text-mist-400 tint-hover hover:text-mist-100",
        className,
      )}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------- Badge */
const TONES = {
  brand: "border-brand-500/25 bg-brand-500/10 text-brand-600",
  verify: "border-verify-400/30 bg-verify-400/10 text-verify-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  reject: "border-reject-400/30 bg-reject-400/10 text-reject-400",
  neutral: "border-[var(--hairline)] tint-1 text-mist-400",
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
    <div className="hair-x flex flex-wrap items-center gap-3 px-5 py-4">
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-bold tracking-[-0.01em] text-mist-100">
          {title}
        </h3>
        {hint && (
          <p className="mt-0.5 truncate text-[13px] text-mist-500">{hint}</p>
        )}
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
      className={cn("tint-3 h-1.5 w-full overflow-hidden rounded-full", className)}
      role="meter"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          bar,
        )}
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- Eyebrow */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="strapline mb-3 text-mist-500">{children}</p>;
}

/* ----------------------------------------------------------- StepCard */
/**
 * The numbered card from the reference: a small preview slot on top, an
 * oversized ordinal, then the claim and the explanation.
 */
export function StepCard({
  index,
  title,
  children,
  preview,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
  preview?: React.ReactNode;
}) {
  return (
    <article className="panel flex h-full flex-col gap-4 p-5">
      {preview && (
        <div className="panel-flat grid min-h-[7.5rem] place-items-center overflow-hidden p-4">
          {preview}
        </div>
      )}
      <p className="font-mono text-[26px] leading-none font-bold text-brand-500/45">
        {String(index).padStart(2, "0")}
      </p>
      <div>
        <h3 className="text-[17px] leading-snug font-bold tracking-[-0.015em] text-mist-100">
          {title}
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-mist-400">
          {children}
        </p>
      </div>
    </article>
  );
}
