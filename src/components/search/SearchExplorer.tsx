"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogRecord, CatalogResult } from "@/lib/catalog";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

type Mode = "raw" | "enriched";

const PRESETS = [
  "half inch black iron nipple",
  "316 stainless full port ball valve",
  "2 inch 150 weld neck flange",
  "lead free potable water valve",
  "4 inch lug butterfly valve epdm",
];

/* ------------------------------------------------------------- indexing */

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9/.-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** What a search engine can see with only the supplier feed. */
function rawIndex(r: CatalogRecord) {
  return [r.raw.brand, r.raw.mpn, r.raw.description, r.raw.supplierCategory]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** What it can see once the record is enriched and published. */
function enrichedIndex(r: CatalogRecord) {
  const attributeText: string[] = [];

  for (const a of r.attributes) {
    if (a.decision !== "publish" || a.value === null) continue;

    // A yes/no attribute is searchable by its name, not its value -
    // buyers type "lead free", never "lead free yes". Critically, a "No"
    // must NOT index the label, or a query for lead free valves returns
    // the ones that explicitly are not.
    if (a.value === "Yes") attributeText.push(a.label);
    else if (a.value === "No") continue;
    else attributeText.push(`${a.label} ${a.value}`);
  }

  return [
    r.raw.brand,
    r.raw.mpn,
    r.raw.description,
    r.className,
    ...r.classPath,
    r.commerce.title,
    ...r.commerce.synonyms,
    ...r.commerce.applications,
    ...attributeText,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Whole-word matching, with a substring fallback for longer terms.
 *
 * Plain substring matching makes short tokens catastrophically loose:
 * a search for a 2 in. flange matches "0.62" and every part number with
 * a 2 in it, and the size filter silently stops meaning anything.
 */
function makeMatcher(haystack: string) {
  const words = new Set(haystack.split(/[^a-z0-9/.-]+/).filter(Boolean));
  return (token: string) =>
    words.has(token) || (token.length >= 4 && haystack.includes(token));
}

interface Hit {
  record: CatalogRecord;
  score: number;
  matchedSynonym: string | null;
}

function search(records: CatalogRecord[], query: string, mode: Mode): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return records.map((record) => ({ record, score: 0, matchedSynonym: null }));
  }

  const tokens = tokenize(q);

  return records
    .map((record) => {
      const haystack = mode === "raw" ? rawIndex(record) : enrichedIndex(record);
      const has = makeMatcher(haystack);

      // AND semantics, the way a storefront actually behaves. A query
      // whose every term cannot be found simply returns nothing.
      if (!tokens.every(has)) return null;

      const matchedSynonym =
        mode === "enriched"
          ? (record.commerce.synonyms.find(
              (s) => s.toLowerCase() === q || s.toLowerCase().includes(q),
            ) ?? null)
          : null;

      // A term that lands on a high-weight attribute is worth more than
      // one that happens to appear in marketing prose.
      const termScore = tokens.reduce((sum, t) => {
        const attr = record.attributes.find(
          (a) =>
            a.decision === "publish" &&
            a.value !== null &&
            makeMatcher(`${a.label} ${a.value}`.toLowerCase())(t),
        );
        return sum + (attr ? attr.searchWeight : 0.4);
      }, 0);

      return {
        record,
        score: termScore + (matchedSynonym ? 3 : 0),
        matchedSynonym,
      };
    })
    .filter((h): h is Hit => h !== null)
    .sort((a, b) => b.score - a.score);
}

/* --------------------------------------------------------------- facets */

interface FacetGroup {
  key: string;
  label: string;
  weight: number;
  values: Array<{ value: string; count: number }>;
}

function buildFacets(hits: Hit[], mode: Mode): FacetGroup[] {
  const groups = new Map<string, FacetGroup>();

  const push = (
    key: string,
    label: string,
    value: string,
    weight: number,
  ) => {
    let group = groups.get(key);
    if (!group) {
      group = { key, label, weight, values: [] };
      groups.set(key, group);
    }
    const existing = group.values.find((v) => v.value === value);
    if (existing) existing.count++;
    else group.values.push({ value, count: 1 });
  };

  for (const { record } of hits) {
    if (mode === "raw") {
      // A raw feed carries a supplier category and a brand. That is the
      // entire navigable surface.
      if (record.raw.supplierCategory) {
        push(
          "supplier_category",
          "Supplier Category",
          record.raw.supplierCategory,
          1,
        );
      }
      push("brand", "Brand", record.raw.brand, 0.9);
      continue;
    }

    push("class", "Product Type", record.className, 1);
    push("brand", "Brand", record.raw.brand, 0.9);
    for (const a of record.attributes) {
      if (!a.facetable || a.decision !== "publish" || a.value === null) continue;
      push(a.key, a.label, a.value, a.searchWeight);
    }
  }

  return [...groups.values()]
    .map((g) => ({
      ...g,
      values: g.values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    }))
    .sort((a, b) => b.weight - a.weight);
}

/* ------------------------------------------------------------ component */

export function SearchExplorer() {
  const [data, setData] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("raw");
  const [query, setQuery] = useState(PRESETS[0]);
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) setFailed(true);
        else setData(json);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const records = data?.records ?? [];

  const hits = useMemo(
    () => search(records, query, mode),
    [records, query, mode],
  );

  const facets = useMemo(() => buildFacets(hits, mode), [hits, mode]);

  const filtered = useMemo(() => {
    const active = Object.entries(selected);
    if (active.length === 0) return hits;

    return hits.filter(({ record }) =>
      active.every(([key, value]) => {
        if (key === "brand") return record.raw.brand === value;
        if (key === "class") return record.className === value;
        if (key === "supplier_category")
          return record.raw.supplierCategory === value;
        return record.attributes.some(
          (a) =>
            a.key === key && a.decision === "publish" && a.value === value,
        );
      }),
    );
  }, [hits, selected]);

  // The counterfactual: what the other mode would have returned.
  const otherHits = useMemo(
    () => search(records, query, mode === "raw" ? "enriched" : "raw"),
    [records, query, mode],
  );
  const otherFacets = useMemo(
    () => buildFacets(otherHits, mode === "raw" ? "enriched" : "raw"),
    [otherHits, mode],
  );

  const facetCount = facets.length;
  const otherFacetCount = otherFacets.length;

  function switchMode(next: Mode) {
    setMode(next);
    setSelected({});
  }

  if (loading) {
    return (
      <Panel className="grid place-items-center px-6 py-24">
        <p className="animate-pulse font-mono text-[11px] tracking-[0.2em] text-brand-400 uppercase">
          running the catalog…
        </p>
      </Panel>
    );
  }

  if (failed || records.length === 0) {
    return (
      <Panel className="grid place-items-center px-6 py-20 text-center">
        <p className="text-sm text-mist-300">The catalog could not be built.</p>
        <p className="mt-1 text-[13px] text-mist-500">
          Reload the page to run it again.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls ------------------------------------------------------ */}
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex rounded-full border border-[var(--hairline)] p-1">
            {(["raw", "enriched"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  "focus-ring rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
                  mode === m
                    ? m === "raw"
                      ? "bg-mist-500/25 text-mist-100"
                      : "bg-brand-500 text-ink-950"
                    : "text-mist-400 hover:text-mist-200",
                )}
              >
                {m === "raw" ? "Raw supplier data" : "Enriched records"}
              </button>
            ))}
          </div>

          <label className="min-w-[16rem] flex-1">
            <span className="sr-only">Search the catalog</span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected({});
              }}
              placeholder="Search the way a buyer types…"
              className="focus-ring w-full rounded-full border border-[var(--hairline)] bg-ink-950/50 px-4 py-2.5 text-sm text-mist-100 transition-colors placeholder:text-mist-600 hover:border-[var(--hairline-strong)] focus:border-brand-500"
            />
          </label>

          {Object.keys(selected).length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
              clear {Object.keys(selected).length} filters
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-[var(--hairline)] px-5 py-3">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setQuery(p);
                setSelected({});
              }}
              className={cn(
                "focus-ring rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
                query === p
                  ? "border-brand-500/50 bg-brand-500/15 text-brand-300"
                  : "border-[var(--hairline)] text-mist-400 hover:border-brand-500/40 hover:text-mist-200",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </Panel>

      {/* Delta strip --------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <DeltaCard
          label="Results returned"
          current={filtered.length}
          other={otherHits.length}
          mode={mode}
          zeroNote="the query finds nothing"
        />
        <DeltaCard
          label="Navigable facets"
          current={facetCount}
          other={otherFacetCount}
          mode={mode}
          zeroNote="nothing to filter by"
        />
        <Panel className="px-5 py-4">
          <p className="font-mono text-[10px] tracking-[0.18em] text-mist-500 uppercase">
            Top result
          </p>
          <p className="mt-1.5 truncate text-[15px] font-bold text-mist-100">
            {filtered[0]?.record.raw.mpn ?? "—"}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-mist-500">
            {filtered[0]
              ? mode === "enriched"
                ? filtered[0].record.commerce.title
                : filtered[0].record.raw.description
              : "no product matched every term"}
          </p>
        </Panel>
      </div>

      {/* Facets + results ---------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <Panel className="h-fit overflow-hidden lg:sticky lg:top-20">
          <PanelHeader
            title="Refine"
            hint={
              mode === "raw"
                ? "All a raw feed can offer"
                : "Built from published attributes"
            }
            right={<Badge tone={mode === "raw" ? "neutral" : "brand"}>{facetCount}</Badge>}
          />

          {facets.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-mist-500">
              No facets — there is nothing structured to filter on.
            </p>
          ) : (
            <div className="max-h-[34rem] divide-y divide-[var(--hairline)] overflow-y-auto">
              {facets.map((g) => (
                <div key={g.key} className="px-5 py-3">
                  <p className="mb-1.5 font-mono text-[10px] tracking-[0.14em] text-mist-500 uppercase">
                    {g.label}
                  </p>
                  <ul className="space-y-0.5">
                    {g.values.slice(0, 6).map((v) => {
                      const active = selected[g.key] === v.value;
                      return (
                        <li key={v.value}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelected((prev) => {
                                const next = { ...prev };
                                if (active) delete next[g.key];
                                else next[g.key] = v.value;
                                return next;
                              })
                            }
                            className={cn(
                              "focus-ring flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] transition-colors",
                              active
                                ? "bg-brand-500/15 text-brand-300"
                                : "text-mist-300 hover:bg-white/5",
                            )}
                          >
                            <span
                              className={cn(
                                "size-3 shrink-0 rounded-[3px] border",
                                active
                                  ? "border-brand-500 bg-brand-500"
                                  : "border-[var(--hairline-strong)]",
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {v.value}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-mist-500">
                              {v.count}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Results"
            hint={
              mode === "raw"
                ? "Matching against brand, MPN and the supplier description"
                : "Matching against the published record, title and trade synonyms"
            }
            right={<Badge tone="neutral">{filtered.length}</Badge>}
          />

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-bold text-mist-300">No results</p>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-mist-500">
                {mode === "raw"
                  ? `Nothing in the supplier feed contains every term in "${query}". The products exist — the data describing them does not.`
                  : "No published record matches every term."}
              </p>
              {mode === "raw" && otherHits.length > 0 && (
                <Button
                  className="mt-5"
                  size="sm"
                  onClick={() => switchMode("enriched")}
                >
                  {otherHits.length} results on the enriched catalog
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-[var(--hairline)]">
              {filtered.map(({ record, matchedSynonym }, i) => (
                <li key={record.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-6 shrink-0 font-mono text-[11px] text-mist-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] leading-snug font-semibold text-mist-100">
                        {mode === "enriched"
                          ? record.commerce.title
                          : record.raw.description}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-mist-500">
                        {record.raw.brand} · {record.raw.mpn}
                        {mode === "raw" && record.raw.supplierCategory
                          ? ` · ${record.raw.supplierCategory}`
                          : ""}
                      </p>

                      {mode === "enriched" && (
                        <>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {record.attributes
                              .filter(
                                (a) =>
                                  a.facetable &&
                                  a.decision === "publish" &&
                                  a.value !== null,
                              )
                              .slice(0, 6)
                              .map((a) => (
                                <span
                                  key={a.key}
                                  className="rounded border border-[var(--hairline)] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-mist-400"
                                >
                                  <span className="text-mist-600">
                                    {a.label}:
                                  </span>{" "}
                                  {a.value}
                                  {a.unit === "in" ? '"' : ""}
                                </span>
                              ))}
                          </div>
                          {matchedSynonym && (
                            <p className="mt-2 font-mono text-[11px] text-brand-300">
                              matched trade synonym “{matchedSynonym}”
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[13px] font-bold tabular-nums text-mist-200">
                        {record.after.total}
                      </span>
                      <span className="block font-mono text-[10px] text-mist-600">
                        quality
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function DeltaCard({
  label,
  current,
  other,
  mode,
  zeroNote,
}: {
  label: string;
  current: number;
  other: number;
  mode: Mode;
  zeroNote: string;
}) {
  const enrichedValue = mode === "enriched" ? current : other;
  const rawValue = mode === "raw" ? current : other;
  const gain = enrichedValue - rawValue;

  return (
    <Panel className="px-5 py-4">
      <p className="font-mono text-[10px] tracking-[0.18em] text-mist-500 uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono text-3xl font-bold tabular-nums",
            current === 0
              ? "text-reject-400"
              : mode === "enriched"
                ? "text-brand-400"
                : "text-mist-200",
          )}
        >
          {current}
        </span>
        {gain !== 0 && (
          <Badge tone={mode === "enriched" ? "verify" : "neutral"}>
            {mode === "enriched" ? `+${gain} vs raw` : `${gain} behind enriched`}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-[12px] text-mist-500">
        {current === 0 ? zeroNote : `${rawValue} raw · ${enrichedValue} enriched`}
      </p>
    </Panel>
  );
}
