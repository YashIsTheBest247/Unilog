"use client";

import { useMemo } from "react";
import { collectReviewQueue, SECONDS_PER_REVIEW, summarize } from "@/lib/record";
import { useWorkspace } from "@/lib/workspace";
import { Badge, Meter, Panel, PanelHeader } from "@/components/ui/kit";
import { SampleNotice, WorkspaceGate } from "@/components/site/WorkspaceGate";
import { cn } from "@/lib/utils";

export function BatchDashboard() {
  const { records, ready, loadSamples, clearSamples } = useWorkspace();

  const summary = useMemo(() => summarize(records), [records]);
  const reviewQueue = useMemo(() => collectReviewQueue(records), [records]);

  if (!ready) {
    return <Panel className="h-64 animate-pulse" />;
  }

  if (records.length === 0) {
    return (
      <WorkspaceGate
        title="Your workspace is empty"
        blurb="Enrich a product and it lands here, with its auto-publish rate, its review queue and its quality score. Nothing is pre-filled — this view only ever shows what you have actually run."
        onLoadSamples={loadSamples}
      />
    );
  }

  const reviewMinutes = Math.ceil(
    (reviewQueue.length * SECONDS_PER_REVIEW) / 60,
  );
  const maxBand = Math.max(...summary.histogram.map((b) => b.count), 1);

  return (
    <div className="space-y-5">
      <SampleNotice
        seeds={summary.seeds}
        total={summary.skus}
        onClear={clearSamples}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Throughput"
            hint={`${summary.skus} record${summary.skus === 1 ? "" : "s"} in the workspace`}
          />
          <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--hairline)] sm:grid-cols-4">
            <Tile
              value={`${Math.round(summary.autoPublishRate * 100)}%`}
              label="Auto-published"
              hint={`${summary.published} of ${summary.attributesFilled} attributes`}
              tone="verify"
            />
            <Tile
              value={summary.review}
              label="Review queue"
              hint={`~${reviewMinutes} min of human time`}
              tone="amber"
            />
            <Tile
              value={summary.refuted}
              label="Claims refuted"
              hint="never reached the storefront"
              tone="reject"
            />
            <Tile
              value={summary.conflicts}
              label="Conflicts resolved"
              hint="sources disagreed"
              tone="brand"
            />
            <Tile
              value={`${summary.attributesFilled}/${summary.attributesRequested}`}
              label="Schema coverage"
              hint="filled vs required"
              tone="brand"
            />
            <Tile
              value={summary.derived}
              label="Your records"
              hint="enriched by you"
              tone="brand"
            />
            <Tile
              value={summary.seeds}
              label="Sample records"
              hint="bundled examples"
              tone="neutral"
            />
            <Tile
              value={records.reduce((n, r) => n + r.sourceCount, 0)}
              label="Sources cited"
              hint="across the workspace"
              tone="neutral"
            />
          </dl>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Quality"
            hint="Supplier feed versus published record"
            right={
              <Badge tone="verify">
                +{summary.avgAfter - summary.avgBefore} avg
              </Badge>
            }
          />
          <div className="px-5 py-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-3xl font-bold text-mist-400 tabular-nums">
                  {summary.avgBefore}
                </p>
                <p className="strapline mt-1 text-[10px] text-mist-500">
                  raw feed
                </p>
              </div>
              <svg
                viewBox="0 0 24 24"
                className="mb-3 size-5 shrink-0 text-brand-500"
                aria-hidden
              >
                <path
                  d="M4 12h16m0 0-5.5-5.5M20 12l-5.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-right">
                <p className="font-mono text-4xl font-bold text-brand-500 tabular-nums">
                  {summary.avgAfter}
                </p>
                <p className="strapline mt-1 text-[10px] text-brand-500">
                  enriched
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <p className="strapline text-[10px] text-mist-500">
                Score distribution
              </p>
              {summary.histogram.map((b) => (
                <div key={b.band} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 font-mono text-[11px] text-mist-500">
                    {b.band}
                  </span>
                  <div className="tint-2 h-4 flex-1 overflow-hidden rounded">
                    <div
                      className={cn(
                        "h-full rounded transition-[width] duration-700",
                        b.count > 0 ? "bg-brand-500/70" : "bg-transparent",
                      )}
                      style={{ width: `${(b.count / maxBand) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-mist-400">
                    {b.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Human review queue"
            hint={`${reviewQueue.length} attributes below the 92% publish threshold`}
            right={<Badge tone="amber">~{reviewMinutes} min</Badge>}
          />
          {reviewQueue.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-mist-500">
              Nothing needs a human. Every filled attribute cleared the
              threshold.
            </p>
          ) : (
            <ul className="max-h-[30rem] divide-y divide-[var(--hairline)] overflow-y-auto">
              {reviewQueue.map((item, i) => (
                <li key={`${item.sku}-${item.key}-${i}`} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-[11px] text-mist-500">
                      {item.mpn}
                    </span>
                    <span className="truncate text-[13px] font-semibold text-mist-200">
                      {item.label}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-amber-500">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>

                  {item.contenders.length > 1 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {item.contenders.map((c, j) => (
                        <span
                          key={`${c}-${j}`}
                          className="flex items-center gap-1.5"
                        >
                          {j > 0 && (
                            <span className="text-[11px] text-mist-600">vs</span>
                          )}
                          <span
                            className={cn(
                              "rounded border px-1.5 py-0.5 font-mono text-[11px]",
                              j === 0
                                ? "border-verify-400/30 bg-verify-400/10 text-verify-400"
                                : "border-reject-400/25 bg-reject-400/[0.08] text-reject-400",
                            )}
                          >
                            {c}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 font-mono text-[12px] text-mist-300">
                      {item.value ?? "—"}
                    </p>
                  )}

                  <p className="mt-1 text-[12px] leading-snug text-mist-500">
                    {item.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Records"
            hint="Everything in the workspace, newest first"
            right={<Badge tone="neutral">{records.length}</Badge>}
          />
          <div className="max-h-[30rem] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10 bg-[var(--s-card)]">
                <tr className="strapline text-[10px] text-mist-500">
                  <th className="px-5 py-2 font-medium">SKU</th>
                  <th className="px-2 py-2 font-medium">Class</th>
                  <th className="px-2 py-2 text-right font-medium">Filled</th>
                  <th className="px-2 py-2 font-medium">Published</th>
                  <th className="px-5 py-2 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline)]">
                {records.map((r) => (
                  <tr key={r.id} className="tint-hover">
                    <td className="px-5 py-2.5">
                      <span className="block truncate font-mono text-[12px] text-mist-100">
                        {r.raw.mpn}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] text-mist-500">
                          {r.raw.brand}
                        </span>
                        {r.seed && (
                          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 font-mono text-[9px] text-amber-500">
                            sample
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-[12px] text-mist-400">
                      {r.className}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[12px] tabular-nums text-mist-300">
                      {r.filled}/{r.requested}
                    </td>
                    <td className="w-28 px-2 py-2.5">
                      <Meter
                        value={r.filled === 0 ? 0 : r.published / r.filled}
                        tone={r.reviewCount === 0 ? "verify" : "amber"}
                      />
                      <span className="mt-1 block font-mono text-[10px] text-mist-500">
                        {r.published} pub · {r.reviewCount} rev
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span className="font-mono text-[13px] font-bold tabular-nums text-mist-100">
                        {r.after.total}
                      </span>
                      <span className="block font-mono text-[10px] text-mist-500">
                        from {r.before.total}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Tile({
  value,
  label,
  hint,
  tone,
}: {
  value: number | string;
  label: string;
  hint: string;
  tone: "verify" | "amber" | "reject" | "brand" | "neutral";
}) {
  const color = {
    verify: "text-verify-400",
    amber: "text-amber-500",
    reject: "text-reject-400",
    brand: "text-brand-500",
    neutral: "text-mist-200",
  }[tone];

  return (
    <div className="px-5 py-4">
      <dd className={cn("font-mono text-2xl font-bold tabular-nums", color)}>
        {value}
      </dd>
      <dt className="mt-1 text-[13px] font-semibold text-mist-200">{label}</dt>
      <p className="text-xs text-mist-500">{hint}</p>
    </div>
  );
}
