"use client";

import { useEffect, useMemo, useState } from "react";
import type { CellStatus, Comparison, Requirement } from "@/lib/pipeline/compare";
import { requirementsFromQuery, runComparison } from "@/lib/pipeline/compare";
import { getClass, TAXONOMY } from "@/data/taxonomy";
import { useWorkspace } from "@/lib/workspace";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/kit";
import { SampleNotice, WorkspaceGate } from "@/components/site/WorkspaceGate";
import { cn } from "@/lib/utils";

interface ClassOption {
  id: string;
  label: string;
  count: number;
  skus: Array<{
    id: string;
    mpn: string;
    brand: string;
    title: string;
    quality: number;
  }>;
}

const PRESETS: Record<string, string> = {
  "PVF-VLV-BALL":
    "3/4 inch bronze full port NPT ball valve rated at least 600 psi, lead free",
  "PVF-FIT-NIPPLE":
    "1/2 inch black steel schedule 40 nipple threaded both ends 4 inch long",
  "PVF-FLG-PIPE": "2 inch class 150 weld neck raised face A105 flange",
  "PVF-VLV-BFLY": "4 inch lug butterfly valve with EPDM seat, gear operated",
};

const CELL: Record<
  CellStatus,
  { label: string; className: string; short: string }
> = {
  pass: {
    label: "Meets",
    short: "✓",
    className: "border-verify-400/30 bg-verify-400/10 text-verify-400",
  },
  fail: {
    label: "Fails",
    short: "✕",
    className: "border-reject-400/30 bg-reject-400/10 text-reject-400",
  },
  unverified: {
    label: "In review",
    short: "~",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  unknown: {
    label: "Unknown",
    short: "?",
    className: "border-[var(--hairline)] tint-1 text-mist-500",
  },
};

export function ComparePanel() {
  const { records, ready, loadSamples, clearSamples } = useWorkspace();
  const [classId, setClassId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Comparison | null>(null);
  const [derived, setDerived] = useState<Requirement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only classes holding more than one candidate are worth comparing.
  const classes: ClassOption[] = useMemo(
    () =>
      TAXONOMY.map((cls) => {
        const inClass = records.filter((r) => r.classId === cls.id);
        return {
          id: cls.id,
          label: cls.label,
          count: inClass.length,
          skus: inClass.map((r) => ({
            id: r.id,
            mpn: r.raw.mpn,
            brand: r.raw.brand,
            title: r.commerce.title,
            quality: r.after.total,
          })),
        };
      }).filter((c) => c.count > 1),
    [records],
  );

  useEffect(() => {
    if (classes.some((c) => c.id === classId)) return;
    const first = classes[0];
    setClassId(first?.id ?? "");
    setQuery(first ? (PRESETS[first.id] ?? "") : "");
    setResult(null);
  }, [classes, classId]);

  const active = useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId],
  );

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!classId || !query.trim() || busy) return;

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const cls = getClass(classId);
      const field = records.filter((r) => r.classId === classId);
      const requirements = requirementsFromQuery(cls, query.trim());

      if (requirements.length === 0) {
        throw new Error(
          "Nothing in that description maps to an attribute of this class. Name a size, a material, a rating or a connection type.",
        );
      }

      setDerived(requirements);
      setResult(runComparison(field, requirements));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Panel className="h-64 animate-pulse" />;

  if (classes.length === 0) {
    return (
      <WorkspaceGate
        title="Not enough to compare"
        blurb="Comparison needs at least two products of the same class in your workspace. Enrich a couple, or load the samples to try it straight away."
        onLoadSamples={loadSamples}
      />
    );
  }

  const seeds = records.filter((r) => r.seed).length;

  return (
    <div className="space-y-5">
      <SampleNotice
        seeds={seeds}
        total={records.length}
        onClear={clearSamples}
      />

      {/* Requirements -------------------------------------------------- */}
      <Panel className="overflow-hidden">
        <PanelHeader
          title="What do you need?"
          hint="Describe the application in plain words — it is parsed into hard and soft constraints"
          right={
            active ? (
              <Badge tone="neutral">{active.count} candidates</Badge>
            ) : undefined
          }
        />

        <div className="flex flex-wrap gap-1.5 px-5 pt-4">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setClassId(c.id);
                setQuery(PRESETS[c.id] ?? "");
                setResult(null);
              }}
              className={cn(
                "focus-ring rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                classId === c.id
                  ? "border-transparent bg-mist-100 text-[var(--s-card)]"
                  : "border-[var(--hairline)] text-mist-400 hover:text-mist-100",
              )}
            >
              {c.label}
              <span className="ml-1.5 font-mono text-[11px] opacity-60">
                {c.count}
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3 px-5 py-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            rows={2}
            placeholder="3/4 inch bronze full port NPT ball valve, at least 600 psi, lead free"
            className="focus-ring field w-full resize-y rounded-xl px-4 py-3 text-[15px] text-mist-100 placeholder:text-mist-600 focus:border-brand-500"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy || !query.trim()}>
              {busy ? "Comparing…" : "Recommend a product"}
            </Button>
            <span className="text-[12px] text-mist-500">⌘↵ to run</span>
          </div>
        </form>

        {derived.length > 0 && (
          <div className="border-t border-[var(--hairline)] px-5 py-3.5">
            <p className="strapline mb-2 text-[10px] text-mist-500">
              Parsed constraints
            </p>
            <div className="flex flex-wrap gap-1.5">
              {derived.map((r) => (
                <span
                  key={r.key}
                  title={r.from ? `read from “${r.from}”` : undefined}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[11px]",
                    r.weight === "must"
                      ? "border-brand-500/35 bg-brand-500/10 text-brand-600"
                      : "border-[var(--hairline)] text-mist-400",
                  )}
                >
                  {r.label} {r.op === "gte" ? "≥" : r.op === "lte" ? "≤" : "="}{" "}
                  {r.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {error && (
        <div
          role="alert"
          className="rounded-[14px] border border-reject-400/30 bg-reject-400/[0.07] px-5 py-4 text-[13px] text-reject-400"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="animate-rise space-y-5">
          {/* Recommendation -------------------------------------------- */}
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Recommendation"
              hint="Chosen on published, verified attributes only"
              right={
                result.winner ? (
                  <Badge tone={result.confidence >= 0.9 ? "verify" : "amber"}>
                    {Math.round(result.confidence * 100)}% confidence
                  </Badge>
                ) : (
                  <Badge tone="reject">no match</Badge>
                )
              }
            />
            <div className="px-5 py-5">
              {result.winner ? (
                <>
                  <p className="text-[13px] text-mist-500">
                    {result.winner.brand}
                  </p>
                  <p className="mt-0.5 font-mono text-[22px] font-bold tracking-[-0.02em] text-mist-100">
                    {result.winner.mpn}
                  </p>
                  <p className="mt-1.5 text-[14px] text-mist-400">
                    {result.winner.title}
                  </p>
                </>
              ) : (
                <p className="text-[17px] font-bold text-mist-100">
                  Nothing in this class meets every hard requirement.
                </p>
              )}

              <ul className="mt-5 space-y-2.5 border-t border-[var(--hairline)] pt-4">
                {result.rationale.map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 text-[14px] leading-relaxed text-mist-300"
                  >
                    <span className="mt-[8px] size-1 shrink-0 rounded-full bg-brand-500" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          {/* Matrix ------------------------------------------------------ */}
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Comparison matrix"
              hint="Unknown is not the same as fails — a gap in the evidence never disqualifies a product"
              right={
                <div className="flex flex-wrap gap-1.5">
                  {(["pass", "fail", "unverified", "unknown"] as CellStatus[]).map(
                    (s) => (
                      <span
                        key={s}
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                          CELL[s].className,
                        )}
                      >
                        {CELL[s].short} {CELL[s].label}
                      </span>
                    ),
                  )}
                </div>
              }
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left">
                <thead>
                  <tr className="border-b border-[var(--hairline)]">
                    <th className="strapline px-5 py-3 text-[10px] text-mist-500">
                      Candidate
                    </th>
                    {result.requirements.map((r) => (
                      <th
                        key={r.key}
                        className="px-2 py-3 text-[11px] font-semibold text-mist-400"
                      >
                        {r.label}
                        <span className="mt-0.5 block font-mono text-[10px] font-normal text-mist-600">
                          {r.op === "gte" ? "≥" : r.op === "lte" ? "≤" : "="}{" "}
                          {r.value}
                        </span>
                      </th>
                    ))}
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-mist-400">
                      Quality
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)]">
                  {result.candidates.map((c) => (
                    <tr
                      key={c.id}
                      className={cn(
                        c.id === result.winner?.id && "bg-verify-400/[0.06]",
                        c.disqualified && "opacity-55",
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] text-mist-100">
                            {c.mpn}
                          </span>
                          {c.id === result.winner?.id && (
                            <Badge tone="verify">pick</Badge>
                          )}
                          {c.disqualified && (
                            <Badge tone="reject">ruled out</Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-mist-500">
                          {c.brand}
                        </span>
                      </td>

                      {result.requirements.map((r) => {
                        const cell = c.cells[r.key];
                        const style = CELL[cell.status];
                        return (
                          <td key={r.key} className="px-2 py-3">
                            <span
                              title={cell.note}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px]",
                                style.className,
                              )}
                            >
                              {style.short}
                              <span className="max-w-[9rem] truncate">
                                {cell.actual ?? "no data"}
                              </span>
                            </span>
                          </td>
                        );
                      })}

                      <td className="px-5 py-3 text-right font-mono text-[13px] font-bold tabular-nums text-mist-200">
                        {c.quality}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
