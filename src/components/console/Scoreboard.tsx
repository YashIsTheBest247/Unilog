"use client";

import type { EnrichedProduct, QualityScore } from "@/lib/types";
import { Badge, Meter, Panel, PanelHeader } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

const DIMENSIONS: Array<{
  key: keyof Omit<QualityScore, "total">;
  label: string;
  weight: string;
}> = [
  { key: "completeness", label: "Completeness", weight: "40%" },
  { key: "verification", label: "Verification", weight: "25%" },
  { key: "richness", label: "Richness", weight: "20%" },
  { key: "searchability", label: "Searchability", weight: "15%" },
];

function ScoreRing({ value, tone }: { value: number; tone: "dim" | "bright" }) {
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="relative grid size-[92px] place-items-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="6"
          className="stroke-[var(--s-hover)]"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-1000 ease-out",
            tone === "bright" ? "stroke-brand-500" : "stroke-mist-500",
          )}
        />
      </svg>
      <span
        className={cn(
          "font-mono text-2xl font-bold tabular-nums",
          tone === "bright" ? "text-mist-100" : "text-mist-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Scoreboard({ product }: { product: EnrichedProduct }) {
  const { before, after, stats } = product;
  const delta = after.total - before.total;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Quality score ------------------------------------------------ */}
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Data quality"
          hint="Supplier row versus published record"
          right={
            <Badge tone={delta > 0 ? "verify" : "neutral"}>
              {delta > 0 ? "+" : ""}
              {delta} pts
            </Badge>
          }
        />

        <div className="flex items-center gap-6 px-5 py-5">
          <div className="text-center">
            <ScoreRing value={before.total} tone="dim" />
            <p className="mt-2 strapline text-[10px] text-mist-500">
              Raw feed
            </p>
          </div>

          <svg
            viewBox="0 0 24 24"
            className="size-5 shrink-0 text-brand-500"
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

          <div className="text-center">
            <ScoreRing value={after.total} tone="bright" />
            <p className="mt-2 strapline text-[10px] text-brand-500">
              Enriched
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-[var(--hairline)] px-5 py-4">
          {DIMENSIONS.map((d) => (
            <div key={d.key}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-mist-300">
                  {d.label}
                </span>
                <span className="font-mono text-[10px] text-mist-500">
                  {d.weight}
                </span>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-mist-400">
                  {Math.round(before[d.key] * 100)}
                  <span className="text-mist-600 mx-1">→</span>
                  <span className="text-mist-100">
                    {Math.round(after[d.key] * 100)}
                  </span>
                </span>
              </div>
              <div className="relative">
                <Meter value={after[d.key]} />
                <div
                  className="absolute top-0 h-1.5 w-px bg-mist-300/70"
                  style={{ left: `${Math.max(1, before[d.key] * 100)}%` }}
                  aria-hidden
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Run stats ---------------------------------------------------- */}
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Run outcome"
          hint={`${product.taxonomy.label} · ${stats.durationMs}ms`}
          right={
            <Badge tone={product.live ? "brand" : "neutral"}>
              {product.live ? "live model" : "demo corpus"}
            </Badge>
          }
        />

        <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--hairline)] sm:grid-cols-3">
          <Tile
            value={stats.published}
            label="Auto-published"
            hint={`of ${stats.attributesFilled} filled`}
            tone="verify"
          />
          <Tile
            value={stats.review}
            label="Queued for review"
            hint="below 0.92 confidence"
            tone="amber"
          />
          <Tile
            value={stats.hallucinationsCaught}
            label="Claims refuted"
            hint="killed by the critic"
            tone="reject"
          />
          <Tile
            value={stats.conflicts}
            label="Conflicts resolved"
            hint="sources disagreed"
            tone="brand"
          />
          <Tile
            value={`${stats.attributesFilled}/${stats.attributesRequested}`}
            label="Schema filled"
            hint="required by this class"
            tone="brand"
          />
          <Tile
            value={product.sources.length}
            label="Sources cited"
            hint="authority ranked"
            tone="neutral"
          />
        </dl>

        <div className="border-t border-[var(--hairline)] px-5 py-3.5">
          <p className="text-[13px] leading-relaxed text-mist-400">
            <span className="text-mist-200">Classified</span> as{" "}
            {product.taxonomy.label} at{" "}
            {Math.round(product.classificationConfidence * 100)}% confidence.{" "}
            {product.classificationRationale}
          </p>
        </div>
      </Panel>
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
