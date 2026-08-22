import { runCatalog, SECONDS_PER_REVIEW } from "@/lib/catalog";
import { Badge, Eyebrow, Meter, Panel, PanelHeader } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catalog run",
  description:
    "Batch enrichment across the full bench: auto-publish rate, human review queue, conflict and refutation counts.",
};

export default async function BatchPage() {
  const { summary, records, reviewQueue } = await runCatalog();

  const reviewMinutes = Math.ceil(
    (reviewQueue.length * SECONDS_PER_REVIEW) / 60,
  );
  const maxBand = Math.max(...summary.histogram.map((b) => b.count), 1);

  return (
    <div className="mx-auto max-w-[1500px] px-5 pt-14 pb-6 sm:px-8">
      <Eyebrow>Batch operations</Eyebrow>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <h1 className="text-[clamp(2rem,3.6vw,2.9rem)] font-extrabold tracking-[-0.03em]">
          Catalog run
        </h1>
        <Badge tone={summary.live ? "brand" : "neutral"}>
          {summary.live ? "live model" : "demo corpus"}
        </Badge>
        <Badge tone="verify">
          {summary.provenance.anchored}/{summary.provenance.total} quotes
          anchored
        </Badge>
      </div>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-mist-400">
        Every SKU on the bench pushed through all eight stages. The number that
        matters is not how many attributes were produced — it is how many were
        produced with enough evidence to publish without a human reading them.
      </p>

      {/* Headline ------------------------------------------------------ */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Throughput"
            hint={`${summary.skus} SKUs in ${summary.durationMs}ms`}
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
              value={summary.seeds}
              label="Seed SKUs"
              hint="hand-sourced evidence"
              tone="neutral"
            />
            <Tile
              value={summary.derived}
              label="Derived SKUs"
              hint="exploded from table rows"
              tone="brand"
            />
            <Tile
              value={`${Math.round(summary.durationMs / summary.skus)}ms`}
              label="Per SKU"
              hint="end to end"
              tone="neutral"
            />
          </dl>

          <div className="border-t border-[var(--hairline)] px-5 py-4">
            <p className="text-[13px] leading-relaxed text-mist-400">
              <span className="text-mist-200">Variant explosion.</span>{" "}
              {summary.seeds} hand-sourced datasheets produced {summary.skus}{" "}
              fully attributed SKUs, because a dimension table names a part per
              row. Derived SKUs cite the same document at their own row, so they
              are exactly as defensible as their parent.
            </p>
          </div>
        </Panel>

        {/* Quality ----------------------------------------------------- */}
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
                <p className="mt-1 font-mono text-[10px] tracking-[0.16em] text-mist-500 uppercase">
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
                <p className="font-mono text-4xl font-bold text-brand-400 tabular-nums">
                  {summary.avgAfter}
                </p>
                <p className="mt-1 font-mono text-[10px] tracking-[0.16em] text-brand-400 uppercase">
                  enriched
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <p className="font-mono text-[10px] tracking-[0.18em] text-mist-500 uppercase">
                Score distribution
              </p>
              {summary.histogram.map((b) => (
                <div key={b.band} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 font-mono text-[11px] text-mist-500">
                    {b.band}
                  </span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-white/[0.05]">
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

      {/* Review queue -------------------------------------------------- */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
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
                <li
                  key={`${item.sku}-${item.key}-${i}`}
                  className="px-5 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-[11px] text-mist-500">
                      {item.mpn}
                    </span>
                    <span className="truncate text-[13px] font-semibold text-mist-200">
                      {item.label}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-amber-400">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>

                  {item.contenders.length > 1 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {item.contenders.map((c, j) => (
                        <span key={`${c}-${j}`} className="flex items-center gap-1.5">
                          {j > 0 && (
                            <span className="text-mist-600 text-[11px]">vs</span>
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

        {/* Per-SKU ---------------------------------------------------- */}
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Records"
            hint="Every SKU in the run, with its published share"
            right={<Badge tone="neutral">{records.length}</Badge>}
          />
          <div className="max-h-[30rem] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10 bg-ink-900/95 backdrop-blur">
                <tr className="font-mono text-[10px] tracking-[0.14em] text-mist-500 uppercase">
                  <th className="px-5 py-2 font-medium">SKU</th>
                  <th className="px-2 py-2 font-medium">Class</th>
                  <th className="px-2 py-2 text-right font-medium">Filled</th>
                  <th className="px-2 py-2 font-medium">Published</th>
                  <th className="px-5 py-2 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline)]">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-2.5">
                      <span className="block truncate font-mono text-[12px] text-mist-100">
                        {r.raw.mpn}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] text-mist-500">
                          {r.raw.brand}
                        </span>
                        {!r.seed && (
                          <span className="rounded border border-brand-500/30 bg-brand-500/10 px-1 font-mono text-[9px] text-brand-300">
                            derived
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
                        tone={r.review === 0 ? "verify" : "amber"}
                      />
                      <span className="mt-1 block font-mono text-[10px] text-mist-500">
                        {r.published} pub · {r.review} rev
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
    brand: "text-brand-400",
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
