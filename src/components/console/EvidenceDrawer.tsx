"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AttributeValue,
  EnrichedProduct,
  EvidenceSource,
} from "@/lib/types";
import { SOURCE_AUTHORITY, SOURCE_LABEL } from "@/lib/types";
import { Badge, Button, Meter } from "@/components/ui/kit";
import { cn } from "@/lib/utils";
import { SOURCE_CODE } from "./AttributeTable";

const VERDICT_TONE = {
  SUPPORTED: "verify",
  UNSUPPORTED: "amber",
  CONTRADICTED: "reject",
} as const;

/**
 * Renders a source excerpt with the cited span highlighted in place.
 *
 * This is the payoff of anchoring every claim to real character offsets
 * during extraction: the operator sees the sentence the value was taken
 * from, not a paraphrase of it.
 */
function Excerpt({
  source,
  start,
  end,
}: {
  source: EvidenceSource;
  start: number;
  end: number;
}) {
  const markRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [source.id, start]);

  if (start < 0) {
    return (
      <pre className="max-h-64 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-mist-400">
        {source.excerpt}
      </pre>
    );
  }

  return (
    <pre className="max-h-64 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-mist-500">
      {source.excerpt.slice(0, start)}
      <span
        ref={markRef}
        className="rounded-[3px] bg-brand-500/25 px-0.5 font-semibold text-mist-100 ring-1 ring-brand-500/50"
      >
        {source.excerpt.slice(start, end)}
      </span>
      {source.excerpt.slice(end)}
    </pre>
  );
}

export function EvidenceDrawer({
  product,
  attribute,
  onClose,
}: {
  product: EnrichedProduct;
  attribute: AttributeValue | null;
  onClose: () => void;
}) {
  const sourceById = useMemo(
    () => new Map(product.sources.map((s) => [s.id, s])),
    [product.sources],
  );

  // Portalled to the body on purpose. A modal is `position: fixed`, and a
  // fixed element resolves against the nearest ancestor carrying a
  // transform rather than the viewport. The page-transition wrapper has
  // one, which sized this panel against the full scroll height of the
  // document and left its content unreachable below the fold.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  /** Keeps Tab inside the dialog while it is open. */
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!attribute) return;

    returnFocusTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      trapFocus(e);
    };

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // Send the caret back where it came from, or the reader loses its place.
      returnFocusTo.current?.focus?.();
    };
  }, [attribute, onClose, trapFocus]);

  if (!attribute || !mounted) return null;

  const spec = product.taxonomy.attributes.find((s) => s.key === attribute.key);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        aria-label="Close evidence panel"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm"
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Evidence for ${attribute.label}`}
        className="animate-rise relative flex h-full w-full max-w-2xl flex-col border-l border-[var(--hairline-strong)] bg-[var(--s-card)] shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.7)]"
      >
        {/* Header ---------------------------------------------------- */}
        <header className="hair-x flex items-start gap-4 px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] tracking-[0.2em] text-brand-400 uppercase">
              {attribute.group} · {attribute.key}
            </p>
            <h3 className="mt-1 text-xl font-bold tracking-[-0.02em]">
              {attribute.label}
            </h3>
            <p className="mt-1 text-[13px] text-mist-500">
              {spec?.description}
            </p>
          </div>
          <Button
            ref={closeRef}
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close evidence panel"
          >
            Esc
          </Button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Value ------------------------------------------------- */}
          <section>
            <div className="panel-flat px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <span
                  className={cn(
                    "font-mono text-2xl font-bold",
                    attribute.value === null
                      ? "text-mist-600 italic"
                      : "text-mist-100",
                  )}
                >
                  {attribute.value ?? "no value published"}
                </span>
                {attribute.unit && attribute.value !== null && (
                  <span className="font-mono text-sm text-mist-400">
                    {attribute.unit}
                  </span>
                )}
                <span className="ml-auto flex gap-2">
                  <Badge tone={VERDICT_TONE[attribute.verdict]}>
                    {attribute.verdict}
                  </Badge>
                  <Badge
                    tone={
                      attribute.decision === "publish"
                        ? "verify"
                        : attribute.decision === "review"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {attribute.decision}
                  </Badge>
                </span>
              </div>

              {attribute.raw && attribute.raw !== attribute.value && (
                <p className="mt-2 font-mono text-[11px] text-mist-500">
                  normalized from &ldquo;{attribute.raw}&rdquo; via{" "}
                  {attribute.method.replace(/_/g, " ")}
                </p>
              )}

              <div className="mt-4">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="strapline text-[10px] text-mist-500">
                    Confidence
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-mist-300">
                    {Math.round(attribute.confidence * 100)}%
                    <span className="ml-2 text-mist-600">
                      publish at 92% · review at 60%
                    </span>
                  </span>
                </div>
                <Meter
                  value={attribute.confidence}
                  tone={
                    attribute.decision === "publish"
                      ? "verify"
                      : attribute.decision === "review"
                        ? "amber"
                        : "reject"
                  }
                />
              </div>
            </div>
          </section>

          {/* Critic ------------------------------------------------ */}
          <section>
            <h4 className="mb-2 strapline text-[10px] text-mist-500">
              Adversarial critic
            </h4>
            <div
              className={cn(
                "rounded-[10px] border px-4 py-3 text-[13px] leading-relaxed",
                attribute.verdict === "SUPPORTED"
                  ? "border-verify-400/25 bg-verify-400/[0.07] text-mist-200"
                  : attribute.verdict === "CONTRADICTED"
                    ? "border-reject-400/25 bg-reject-400/[0.07] text-mist-200"
                    : "border-amber-500/25 bg-amber-500/[0.07] text-mist-200",
              )}
            >
              {attribute.criticNote}
            </div>
            {attribute.validationError && (
              <p className="mt-2 font-mono text-[11px] text-amber-400">
                validator: {attribute.validationError}
              </p>
            )}
          </section>

          {/* Conflict ---------------------------------------------- */}
          {attribute.conflict && (
            <section>
              <h4 className="mb-2 strapline text-[10px] text-mist-500">
                {attribute.conflict.resolution === "unit_equivalent"
                  ? "Cross-unit corroboration"
                  : "Source conflict"}
              </h4>
              <div className="panel-flat overflow-hidden">
                <ul className="divide-y divide-[var(--hairline)]">
                  {attribute.conflict.contenders.map((c, i) => {
                    const source = sourceById.get(c.sourceId);
                    const winner = i === 0;
                    return (
                      <li
                        key={c.sourceId}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5",
                          winner && "bg-verify-400/[0.06]",
                        )}
                      >
                        <span className="w-11 shrink-0 font-mono text-[10px] text-mist-500">
                          {source ? SOURCE_CODE[source.kind] : "?"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-[13px] text-mist-100">
                            {c.normalized ?? c.raw}
                          </span>
                          <span className="block truncate text-[11px] text-mist-500">
                            {source?.title}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-mist-500">
                          {source
                            ? SOURCE_AUTHORITY[source.kind].toFixed(2)
                            : "—"}
                        </span>
                        {winner && <Badge tone="verify">kept</Badge>}
                        {!winner &&
                          attribute.conflict?.resolution === "authority" && (
                            <Badge tone="reject">dropped</Badge>
                          )}
                        {!winner &&
                          attribute.conflict?.resolution ===
                            "unit_equivalent" && (
                            <Badge tone="brand">agrees</Badge>
                          )}
                      </li>
                    );
                  })}
                </ul>
                <p className="border-t border-[var(--hairline)] px-4 py-2.5 text-[12px] leading-relaxed text-mist-400">
                  {attribute.conflict.note}
                </p>
              </div>
            </section>
          )}

          {/* Citations --------------------------------------------- */}
          <section>
            <h4 className="mb-2 strapline text-[10px] text-mist-500">
              Cited evidence ({attribute.citations.length})
            </h4>

            {attribute.citations.length === 0 ? (
              <p className="panel-flat px-4 py-6 text-center text-[13px] text-mist-500">
                Nothing in the evidence pool asserts this attribute. It is a
                genuine gap, not a silent omission.
              </p>
            ) : (
              <ul className="space-y-3">
                {attribute.citations.map((c) => {
                  const source = sourceById.get(c.sourceId);
                  if (!source) return null;
                  return (
                    <li key={c.sourceId} className="panel-flat overflow-hidden">
                      <div className="hair-x flex items-start gap-3 px-4 py-3">
                        <Badge tone="neutral">{SOURCE_CODE[source.kind]}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-mist-100">
                            {source.title}
                          </p>
                          <p className="truncate font-mono text-[11px] text-mist-500">
                            {SOURCE_LABEL[source.kind]} · {source.locator}
                          </p>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="block font-mono text-[11px] text-mist-300">
                            {SOURCE_AUTHORITY[source.kind].toFixed(2)}
                          </span>
                          <span className="block font-mono text-[10px] text-mist-600">
                            authority
                          </span>
                        </span>
                      </div>
                      <Excerpt source={source} start={c.start} end={c.end} />
                      <p className="border-t border-[var(--hairline)] px-4 py-2 font-mono text-[10px] text-mist-600">
                        chars {c.start}–{c.end} ·{" "}
                        <span className="text-mist-500">{source.url}</span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
