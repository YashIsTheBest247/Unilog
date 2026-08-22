"use client";

import { useMemo, useState } from "react";
import type {
  AttributeValue,
  EnrichedProduct,
  EvidenceSource,
  SourceKind,
} from "@/lib/types";
import { SOURCE_AUTHORITY } from "@/lib/types";
import { Badge, Panel, PanelHeader } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

export const SOURCE_CODE: Record<SourceKind, string> = {
  manufacturer_datasheet: "DS",
  manufacturer_web: "MFR",
  catalog_pdf: "CAT",
  distributor_listing: "DIST",
  marketplace: "MKT",
  product_image: "IMG",
};

type Filter = "all" | "publish" | "review" | "conflict" | "gap";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "publish", label: "Published" },
  { id: "review", label: "Review" },
  { id: "conflict", label: "Conflicts" },
  { id: "gap", label: "Gaps" },
];

function matches(a: AttributeValue, filter: Filter) {
  switch (filter) {
    case "publish":
      return a.decision === "publish";
    case "review":
      return a.decision === "review";
    case "conflict":
      return Boolean(a.conflict);
    case "gap":
      return a.value === null;
    default:
      return true;
  }
}

/**
 * A compact badge naming a source the value came from.
 *
 * Deliberately not a button: the whole row is already the control that
 * opens the evidence, and nesting an interactive element inside it
 * would be invalid markup and a keyboard trap for no extra capability.
 */
function ProvenanceChip({ source }: { source: EvidenceSource }) {
  const authority = SOURCE_AUTHORITY[source.kind];
  return (
    <span
      title={`${source.title} — ${source.locator} (authority ${authority.toFixed(2)})`}
      className={cn(
        "rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium",
        authority >= 0.9
          ? "border-verify-400/30 bg-verify-400/10 text-verify-400"
          : authority >= 0.66
            ? "border-brand-500/30 bg-brand-500/10 text-brand-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-400",
      )}
    >
      {SOURCE_CODE[source.kind]}
    </span>
  );
}

export function AttributeTable({
  product,
  onInspect,
}: {
  product: EnrichedProduct;
  onInspect: (attribute: AttributeValue) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const sourceById = useMemo(
    () => new Map(product.sources.map((s) => [s.id, s])),
    [product.sources],
  );

  const groups = useMemo(() => {
    const visible = product.attributes.filter((a) => matches(a, filter));
    const map = new Map<string, AttributeValue[]>();
    for (const a of visible) {
      const list = map.get(a.group);
      if (list) list.push(a);
      else map.set(a.group, [a]);
    }
    return [...map.entries()];
  }, [product.attributes, filter]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [
          f.id,
          product.attributes.filter((a) => matches(a, f.id)).length,
        ]),
      ) as Record<Filter, number>,
    [product.attributes],
  );

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Attribute record"
        hint="Click any row to open the evidence behind the value"
        right={
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "focus-ring rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  filter === f.id
                    ? "bg-brand-500 text-[var(--on-accent)]"
                    : "text-mist-400 tint-hover hover:text-mist-200",
                )}
              >
                {f.label}
                <span className="ml-1 font-mono opacity-60">
                  {counts[f.id]}
                </span>
              </button>
            ))}
          </div>
        }
      />

      {groups.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-mist-500">
          No attributes match this filter.
        </p>
      ) : (
        <div className="divide-y divide-[var(--hairline)]">
          {groups.map(([group, attributes]) => (
            <section key={group}>
              <h4 className="tint-1 px-5 py-2 strapline text-[10px] text-mist-500">
                {group}
              </h4>
              <ul className="divide-y divide-[var(--hairline)]">
                {attributes.map((a) => (
                  <li key={a.key}>
                    <button
                      type="button"
                      onClick={() => onInspect(a)}
                      aria-label={`${a.label}: ${a.value ?? "no evidence"}. Open the evidence behind this value.`}
                      className="focus-ring group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-brand-500/[0.06] sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]"
                    >
                      {/* Label ------------------------------------- */}
                      <span className="flex items-center gap-1.5 pt-0.5 text-[13px] font-medium text-mist-400">
                        {a.label}
                        {a.conflict && (
                          <span
                            title="Sources disagreed on this value"
                            className="size-1.5 shrink-0 rounded-full bg-amber-500"
                          />
                        )}
                      </span>

                      {/* Value ------------------------------------- */}
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate font-mono text-sm",
                            a.value === null
                              ? "text-mist-600 italic"
                              : a.decision === "publish"
                                ? "text-mist-100"
                                : "text-amber-400",
                          )}
                        >
                          {a.value === null ? "no evidence" : a.value}
                          {a.value !== null && a.unit && a.unit !== "in" && (
                            <span className="ml-1 text-mist-500">{a.unit}</span>
                          )}
                          {a.value !== null && a.unit === "in" && (
                            <span className="text-mist-500">&quot;</span>
                          )}
                        </span>
                        {a.raw && a.raw !== a.value && (
                          <span className="mt-0.5 block truncate font-mono text-[11px] text-mist-600">
                            source said &ldquo;{a.raw}&rdquo;
                          </span>
                        )}
                      </span>

                      {/* Provenance + decision --------------------- */}
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="hidden gap-1 sm:flex">
                          {a.citations.slice(0, 4).map((c) => {
                            const source = sourceById.get(c.sourceId);
                            if (!source) return null;
                            return (
                              <ProvenanceChip key={c.sourceId} source={source} />
                            );
                          })}
                        </span>

                        <span className="w-11 text-right font-mono text-[11px] tabular-nums text-mist-500">
                          {a.value === null
                            ? "—"
                            : `${Math.round(a.confidence * 100)}%`}
                        </span>

                        <DecisionPip decision={a.decision} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

function DecisionPip({ decision }: { decision: AttributeValue["decision"] }) {
  const map = {
    publish: { tone: "verify" as const, label: "PUB" },
    review: { tone: "amber" as const, label: "REV" },
    reject: { tone: "neutral" as const, label: "—" },
  }[decision];

  return (
    <Badge tone={map.tone} className="w-[3.4rem] justify-center">
      {map.label}
    </Badge>
  );
}
