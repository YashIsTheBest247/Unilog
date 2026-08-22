"use client";

import { useState } from "react";
import type { AttributeValue, EnrichedProduct } from "@/lib/types";
import { SOURCE_AUTHORITY } from "@/lib/types";
import { Badge, Panel, PanelHeader } from "@/components/ui/kit";
import { cn } from "@/lib/utils";
import { SOURCE_CODE } from "./AttributeTable";

/* ------------------------------------------------------------ critic log */

export function CriticLog({
  product,
  onInspect,
}: {
  product: EnrichedProduct;
  onInspect: (attribute: AttributeValue) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const sourceById = new Map(product.sources.map((s) => [s.id, s]));

  const contradicted = product.refuted.filter(
    (r) => r.verdict === "CONTRADICTED",
  );
  const visible = showAll ? product.refuted : contradicted;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Critic log"
        hint="Claims the adversarial pass killed before publication"
        right={
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="focus-ring rounded-full px-2.5 py-1 text-[11px] font-semibold text-mist-400 transition-colors hover:bg-white/5 hover:text-mist-200"
          >
            {showAll ? "contradictions only" : `all ${product.refuted.length}`}
          </button>
        }
      />

      {visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-mist-500">
          Nothing was refuted. Every candidate held up against its source.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--hairline)]">
          {visible.map((r, i) => {
            const source = sourceById.get(r.sourceId);
            const attribute = product.attributes.find((a) => a.key === r.key);

            return (
              <li key={`${r.key}-${r.sourceId}-${i}`}>
                <button
                  type="button"
                  onClick={() => attribute && onInspect(attribute)}
                  className="focus-ring w-full px-5 py-3 text-left transition-colors hover:bg-reject-400/[0.06]"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={r.verdict === "CONTRADICTED" ? "reject" : "amber"}
                    >
                      {r.verdict}
                    </Badge>
                    <span className="truncate text-[13px] font-semibold text-mist-200">
                      {r.label}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-mist-500">
                      {source ? SOURCE_CODE[source.kind] : "?"}{" "}
                      {source ? SOURCE_AUTHORITY[source.kind].toFixed(2) : ""}
                    </span>
                  </div>

                  <p className="mt-1.5 font-mono text-[12px] text-reject-400 line-through decoration-reject-400/50">
                    {r.normalized ?? r.raw}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-mist-500">
                    {r.note}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------- conflicts */

export function ConflictPanel({
  product,
  onInspect,
}: {
  product: EnrichedProduct;
  onInspect: (attribute: AttributeValue) => void;
}) {
  const conflicted = product.attributes.filter((a) => a.conflict);
  const sourceById = new Map(product.sources.map((s) => [s.id, s]));

  if (conflicted.length === 0) return null;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Source disagreements"
        hint="Both values kept on the record, with how the tie was broken"
        right={<Badge tone="amber">{conflicted.length}</Badge>}
      />
      <ul className="divide-y divide-[var(--hairline)]">
        {conflicted.map((a) => (
          <li key={a.key}>
            <button
              type="button"
              onClick={() => onInspect(a)}
              className="focus-ring w-full px-5 py-3 text-left transition-colors hover:bg-amber-500/[0.06]"
            >
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-mist-200">
                  {a.label}
                </span>
                <Badge
                  tone={
                    a.conflict?.resolution === "unit_equivalent"
                      ? "brand"
                      : "amber"
                  }
                  className="ml-auto"
                >
                  {a.conflict?.resolution === "unit_equivalent"
                    ? "same value"
                    : "authority"}
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                {a.conflict?.contenders.map((c, i) => {
                  const source = sourceById.get(c.sourceId);
                  return (
                    <span key={c.sourceId} className="flex items-center gap-1.5">
                      {i > 0 && (
                        <span className="text-mist-600">
                          {a.conflict?.resolution === "unit_equivalent"
                            ? "="
                            : "vs"}
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-mono text-[11px]",
                          i === 0
                            ? "border-verify-400/30 bg-verify-400/10 text-verify-400"
                            : a.conflict?.resolution === "unit_equivalent"
                              ? "border-brand-500/30 bg-brand-500/10 text-brand-300"
                              : "border-reject-400/25 bg-reject-400/[0.08] text-reject-400 line-through",
                        )}
                      >
                        {c.normalized ?? c.raw}
                      </span>
                      <span className="font-mono text-[10px] text-mist-600">
                        {source ? SOURCE_CODE[source.kind] : "?"}
                      </span>
                    </span>
                  );
                })}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* -------------------------------------------------------------- commerce */

export function CommercePanel({ product }: { product: EnrichedProduct }) {
  const { commerce } = product;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Commerce output"
        hint="Composed from published attributes only"
        right={<Badge tone="brand">{commerce.synonyms.length} synonyms</Badge>}
      />

      <div className="space-y-5 px-5 py-4">
        <div>
          <p className="mb-1.5 font-mono text-[10px] tracking-[0.18em] text-mist-500 uppercase">
            Product title
          </p>
          <p className="text-[15px] leading-snug font-semibold text-mist-100">
            {commerce.title}
          </p>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[10px] tracking-[0.18em] text-mist-500 uppercase">
            Feature bullets
          </p>
          <ul className="space-y-1">
            {commerce.bullets.map((b) => (
              <li
                key={b}
                className="flex gap-2 text-[13px] leading-snug text-mist-300"
              >
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-brand-500" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[10px] tracking-[0.18em] text-mist-500 uppercase">
            Search synonyms
          </p>
          <div className="flex flex-wrap gap-1.5">
            {commerce.synonyms.map((s) => (
              <span
                key={s}
                className="rounded-full border border-[var(--hairline)] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-mist-300"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[10px] tracking-[0.18em] text-mist-500 uppercase">
            Applications
          </p>
          <div className="flex flex-wrap gap-1.5">
            {commerce.applications.map((a) => (
              <Badge key={a} tone="neutral">
                {a}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[10px] tracking-[0.18em] text-mist-500 uppercase">
            Meta description
          </p>
          <p className="text-[13px] leading-relaxed text-mist-400">
            {commerce.metaDescription}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------- sources */

export function SourcePanel({ product }: { product: EnrichedProduct }) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Evidence pool"
        hint="Ranked by source authority"
        right={<Badge tone="neutral">{product.sources.length}</Badge>}
      />
      <ul className="divide-y divide-[var(--hairline)]">
        {product.sources.map((s) => {
          const authority = SOURCE_AUTHORITY[s.kind];
          const used = product.attributes.filter((a) =>
            a.citations.some((c) => c.sourceId === s.id),
          ).length;

          return (
            <li key={s.id} className="flex items-start gap-3 px-5 py-3">
              <Badge tone="neutral" className="mt-0.5 shrink-0">
                {SOURCE_CODE[s.kind]}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-mist-200">
                  {s.title}
                </p>
                <p className="truncate font-mono text-[11px] text-mist-500">
                  {s.locator}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 w-20 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        authority >= 0.9
                          ? "bg-verify-400"
                          : authority >= 0.66
                            ? "bg-brand-500"
                            : "bg-amber-500",
                      )}
                      style={{ width: `${authority * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-mist-500">
                    {authority.toFixed(2)} authority · {used} values
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
