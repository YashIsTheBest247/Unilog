"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AttributeValue } from "@/lib/types";
import { toCatalogRecord } from "@/lib/record";
import { useWorkspace } from "@/lib/workspace";
import { useEnrichment } from "@/lib/useEnrichment";
import type { EnrichmentInput } from "@/lib/useEnrichment";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/kit";
import { cn } from "@/lib/utils";
import { AttributeTable } from "./AttributeTable";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { Scoreboard } from "./Scoreboard";
import { StageTrack } from "./StageTrack";
import { CommercePanel, ConflictPanel, CriticLog, SourcePanel } from "./SideRail";
import { SourceIngest } from "./SourceIngest";
import type { AttachedSource } from "./SourceIngest";

interface Sample extends EnrichmentInput {
  id: string;
  sourceCount: number;
  sourceKinds: string[];
}

const EMPTY: EnrichmentInput = {
  mpn: "",
  brand: "",
  description: "",
  supplierCategory: "",
};

export function EnrichConsole() {
  const { status, stages, logs, product, error, run, reset } = useEnrichment();
  const [form, setForm] = useState<EnrichmentInput>(EMPTY);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [attached, setAttached] = useState<AttachedSource[]>([]);
  const [inspecting, setInspecting] = useState<AttributeValue | null>(null);
  const { save, records } = useWorkspace();
  const savedId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/samples")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: Sample[] = data.samples ?? [];
        setSamples(list);
        setForm((f) => (f.mpn ? f : (list[0] ?? EMPTY)));
      })
      .catch(() => {
        /* The form still works by hand if the bench cannot load. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Every completed run joins the workspace, which is what the batch,
  // search, compare and graph views actually read.
  useEffect(() => {
    if (!product || savedId.current === product.raw.id) return;
    savedId.current = product.raw.id;
    save(toCatalogRecord(product, { seed: false }));
  }, [product, save]);

  const running = status === "running";
  const canRun = form.mpn.trim() !== "" && form.brand.trim() !== "" && !running;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canRun) return;
    setInspecting(null);
    void run({
      mpn: form.mpn.trim(),
      brand: form.brand.trim(),
      description: form.description.trim(),
      supplierCategory: form.supplierCategory?.trim() || undefined,
      sources: attached.map(({ kind, title, locator, url, text }) => ({
        kind,
        title,
        locator,
        url,
        text,
      })),
    });
  }

  return (
    <div className="space-y-5">
      {/* Input + trace ------------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-5">
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Supplier row"
              hint="Paste a real vendor line, however abbreviated"
              right={
                status !== "idle" && (
                  <button
                    type="button"
                    onClick={() => {
                      reset();
                      setInspecting(null);
                    }}
                    className="focus-ring rounded-full px-2.5 py-1 text-[11px] font-semibold text-mist-400 tint-hover hover:text-mist-200"
                  >
                    clear
                  </button>
                )
              }
            />

            <form onSubmit={submit} className="space-y-4 px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Brand"
                  value={form.brand}
                  onChange={(v) => setForm({ ...form, brand: v })}
                  placeholder="Apollo"
                />
                <Field
                  label="Manufacturer part number"
                  value={form.mpn}
                  onChange={(v) => setForm({ ...form, mpn: v })}
                  placeholder="77C-143-01"
                  mono
                />
              </div>

              <Field
                label="Description"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
                placeholder="BALL VLV 1/2 3PC SS FP LKG HDL"
                mono
              />

              <Field
                label="Supplier category"
                value={form.supplierCategory ?? ""}
                onChange={(v) => setForm({ ...form, supplierCategory: v })}
                placeholder="VALVES & ACTUATORS"
                optional
              />

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="submit" disabled={!canRun}>
                  {running ? "Enriching…" : "Run enrichment"}
                </Button>
                <p className="text-xs text-mist-500">
                  {attached.length > 0
                    ? `${attached.length} supplied document${attached.length === 1 ? "" : "s"}.`
                    : "Eight stages, streamed live."}
                </p>
                {records.length > 0 && (
                  <Link
                    href="/batch"
                    className="focus-ring ml-auto rounded-full px-3 py-1 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    {records.length} in workspace →
                  </Link>
                )}
              </div>
            </form>
          </Panel>

          <SourceIngest
            sources={attached}
            onChange={setAttached}
            disabled={running}
          />

          {/* Demo bench ---------------------------------------------- */}
          {samples.length > 0 && (
            <Panel className="overflow-hidden">
              <PanelHeader
                title="Sample rows"
                hint="Bundled examples for trying the engine without a document of your own"
              />
              <ul className="divide-y divide-[var(--hairline)]">
                {samples.map((s) => {
                  const active = s.mpn === form.mpn;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={running}
                        onClick={() => setForm(s)}
                        className={cn(
                          "focus-ring w-full px-5 py-3 text-left transition-colors disabled:opacity-50",
                          active
                            ? "bg-brand-500/[0.08]"
                            : "hover:tint-1",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "truncate text-[13px] font-semibold",
                              active ? "text-brand-300" : "text-mist-200",
                            )}
                          >
                            {s.brand}
                          </span>
                          <span className="truncate font-mono text-[11px] text-mist-500">
                            {s.mpn}
                          </span>
                          <Badge tone="neutral" className="ml-auto shrink-0">
                            {s.sourceCount} src
                          </Badge>
                        </div>
                        <p className="mt-1 truncate font-mono text-[12px] text-mist-400">
                          {s.description}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <StageTrack stages={stages} logs={logs} status={status} />
        </div>
      </div>

      {/* Error --------------------------------------------------------- */}
      {error && (
        <div
          role="alert"
          className="rounded-[14px] border border-reject-400/30 bg-reject-400/[0.08] px-5 py-4"
        >
          <p className="text-[13px] font-semibold text-reject-400">
            The run could not complete
          </p>
          <p className="mt-1 text-[13px] text-mist-300">{error}</p>
        </div>
      )}

      {/* Result -------------------------------------------------------- */}
      {product && (
        <div className="animate-rise space-y-5">
          <Scoreboard product={product} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <AttributeTable product={product} onInspect={setInspecting} />

            <div className="space-y-5">
              <CriticLog product={product} onInspect={setInspecting} />
              <ConflictPanel product={product} onInspect={setInspecting} />
              <CommercePanel product={product} />
              <SourcePanel product={product} />
            </div>
          </div>
        </div>
      )}

      {product && (
        <EvidenceDrawer
          product={product}
          attribute={inspecting}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  optional,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 strapline text-[10px] text-mist-500">
        {label}
        {optional && <span className="text-mist-600 normal-case">optional</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "focus-ring w-full rounded-lg field px-3 py-2.5 text-sm text-mist-100 transition-colors placeholder:text-mist-600 hover:border-[var(--hairline-strong)] focus:border-brand-500",
          mono && "font-mono",
        )}
      />
    </label>
  );
}
