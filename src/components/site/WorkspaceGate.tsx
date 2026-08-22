"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Panel } from "@/components/ui/kit";
import { Arrow } from "@/components/site/Header";

/**
 * What every downstream view shows before anything has been enriched.
 *
 * The offer to load the bundled samples sits here rather than being
 * applied automatically, so a first-time screen is honestly empty
 * instead of quietly presenting fixture data as the user's catalogue.
 */
export function WorkspaceGate({
  title,
  blurb,
  onLoadSamples,
}: {
  title: string;
  blurb: string;
  onLoadSamples: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      await onLoadSamples();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="grid place-items-center px-6 py-20 text-center">
      <div className="max-w-md">
        <h2 className="text-[22px] font-bold tracking-[-0.02em] text-mist-100">
          {title}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-mist-400">
          {blurb}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/#console"
            className="focus-ring inline-flex items-center gap-2 rounded-full bg-mist-100 px-5 py-2.5 text-sm font-semibold text-[var(--s-card)] transition-opacity hover:opacity-88"
          >
            Enrich a product
            <Arrow />
          </Link>
          <Button variant="outline" size="md" disabled={busy} onClick={load}>
            {busy ? "Loading…" : "Load the sample catalogue"}
          </Button>
        </div>

        <p className="mt-4 text-[12px] text-mist-500">
          Samples are clearly flagged and can be cleared at any time.
        </p>

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-reject-400">
            {error}
          </p>
        )}
      </div>
    </Panel>
  );
}

/** A compact banner naming how much of the current view is sample data. */
export function SampleNotice({
  seeds,
  total,
  onClear,
}: {
  seeds: number;
  total: number;
  onClear: () => void;
}) {
  if (seeds === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-amber-500/30 bg-amber-500/[0.07] px-4 py-2.5">
      <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
      <p className="text-[13px] text-mist-300">
        {seeds === total
          ? "Showing the bundled sample catalogue."
          : `${seeds} of ${total} records are bundled samples.`}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="focus-ring ml-auto rounded-full px-3 py-1 text-[12px] font-semibold text-amber-500 transition-colors hover:bg-amber-500/10"
      >
        Clear samples
      </button>
    </div>
  );
}
