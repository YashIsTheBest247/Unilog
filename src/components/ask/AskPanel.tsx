"use client";

import { useEffect, useRef, useState } from "react";
import type { Answer, AnswerStatus } from "@/lib/pipeline/ask";
import { SOURCE_LABEL } from "@/lib/types";
import type { SourceKind } from "@/lib/types";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/kit";
import { SOURCE_CODE } from "@/components/console/AttributeTable";
import { SourceIngest } from "@/components/console/SourceIngest";
import type { AttachedSource } from "@/components/console/SourceIngest";
import { cn } from "@/lib/utils";

interface Sample {
  id: string;
  mpn: string;
  brand: string;
  description: string;
  sourceCount: number;
}

interface PoolSource {
  id: string;
  kind: SourceKind;
  title: string;
  locator: string;
  url: string;
  excerpt: string;
}

const PRESETS = [
  "What is the maximum operating temperature?",
  "Is this certified lead free for potable water?",
  "How many bolt holes and what is the bolt circle diameter?",
  "What is the flow coefficient Cv?",
  "What is the seismic qualification level?",
];

const STATUS: Record<
  AnswerStatus,
  { tone: "verify" | "amber" | "reject"; label: string; blurb: string }
> = {
  ANSWERED: {
    tone: "verify",
    label: "Answered",
    blurb: "The documents state this outright.",
  },
  PARTIAL: {
    tone: "amber",
    label: "Partial",
    blurb: "The documents bear on this but do not settle it.",
  },
  NOT_FOUND: {
    tone: "reject",
    label: "Not found",
    blurb: "Nothing in the documents speaks to this question.",
  },
};

/** Highlights the cited span inside the source excerpt, in place. */
function Excerpt({
  excerpt,
  start,
  end,
}: {
  excerpt: string;
  start: number;
  end: number;
}) {
  const markRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
  }, [start]);

  if (start < 0) {
    return (
      <pre className="max-h-56 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-mist-400">
        {excerpt}
      </pre>
    );
  }

  return (
    <pre className="max-h-56 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-mist-500">
      {excerpt.slice(0, start)}
      <span
        ref={markRef}
        className="rounded-[3px] bg-brand-500/20 px-0.5 font-semibold text-mist-100 ring-1 ring-brand-500/40"
      >
        {excerpt.slice(start, end)}
      </span>
      {excerpt.slice(end)}
    </pre>
  );
}

export function AskPanel() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selected, setSelected] = useState<Sample | null>(null);
  const [attached, setAttached] = useState<AttachedSource[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pool, setPool] = useState<PoolSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/samples")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSamples(data.samples ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!question.trim() || busy) return;

    setBusy(true);
    setError(null);
    setAnswer(null);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          mpn: selected?.mpn ?? "",
          brand: selected?.brand ?? "",
          sources: attached.map(({ kind, title, locator, url, text }) => ({
            kind,
            title,
            locator,
            url,
            text,
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "The question failed.");
      setAnswer(json.answer);
      setPool(json.sources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const excerptById = new Map(pool.map((s) => [s.id, s]));
  const status = answer ? STATUS[answer.status] : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      {/* Left: what it reads.
          The user's own documents lead. The bundled sets sit behind a
          disclosure and vanish once anything has been attached. ------ */}
      <div className="space-y-5">
        <SourceIngest
          sources={attached}
          onChange={setAttached}
          disabled={busy}
        />

        {samples.length > 0 && attached.length === 0 && (
          <Panel className="overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSamples((v) => !v)}
              aria-expanded={showSamples}
              className="focus-ring flex w-full items-center gap-3 px-5 py-4 text-left transition-colors tint-hover"
            >
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold tracking-[-0.01em] text-mist-100">
                  No document to hand?
                </h3>
                <p className="mt-0.5 text-[13px] text-mist-500">
                  {selected
                    ? `Reading ${selected.brand} ${selected.mpn}`
                    : `Read one of ${samples.length} bundled sample sets`}
                </p>
              </div>
              {selected && (
                <Badge tone="brand" className="shrink-0">
                  {selected.sourceCount} docs
                </Badge>
              )}
              <svg
                viewBox="0 0 16 16"
                aria-hidden
                className={cn(
                  "ml-auto size-4 shrink-0 text-mist-400 transition-transform duration-200",
                  showSamples && "rotate-180",
                )}
              >
                <path
                  d="m4 6 4 4 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {showSamples && (
              <ul className="animate-rise divide-y divide-[var(--hairline)] border-t border-[var(--hairline)]">
                {samples.map((s) => {
                  const active = selected?.id === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(active ? null : s)}
                        className={cn(
                          "focus-ring w-full px-5 py-3 text-left transition-colors",
                          active ? "bg-brand-500/[0.07]" : "tint-hover",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-3 shrink-0 rounded-[4px] border",
                              active
                                ? "border-brand-500 bg-brand-500"
                                : "border-[var(--hairline-strong)]",
                            )}
                          />
                          <span className="truncate text-[13px] font-semibold text-mist-100">
                            {s.brand}
                          </span>
                          <span className="truncate font-mono text-[11px] text-mist-500">
                            {s.mpn}
                          </span>
                          <Badge tone="neutral" className="ml-auto shrink-0">
                            {s.sourceCount}
                          </Badge>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {/* Right: the question and the answer --------------------------- */}
      <div className="space-y-5">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Ask"
            hint="Answered only from the attached documents — never from what a model happens to know"
          />

          <form onSubmit={submit} className="space-y-3 px-5 py-4">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
              }}
              rows={2}
              placeholder="Can this handle water at 80 °C?"
              className="focus-ring field w-full resize-y rounded-xl px-4 py-3 text-[15px] text-mist-100 placeholder:text-mist-600 focus:border-brand-500"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={busy || !question.trim()}>
                {busy ? "Reading…" : "Ask the documents"}
              </Button>
              <span className="text-[12px] text-mist-500">⌘↵ to send</span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setQuestion(p)}
                  className={cn(
                    "focus-ring rounded-full border px-3 py-1 text-[11px] transition-colors",
                    question === p
                      ? "border-brand-500/45 bg-brand-500/10 text-brand-600"
                      : "border-[var(--hairline)] text-mist-400 hover:text-mist-200",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </form>
        </Panel>

        {!selected && attached.length === 0 && !answer && (
          <Panel className="px-5 py-10 text-center">
            <p className="text-[14px] text-mist-400">
              Attach a datasheet, fetch a product URL, or paste a spec block —
              then ask it anything.
            </p>
          </Panel>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-[14px] border border-reject-400/30 bg-reject-400/[0.07] px-5 py-4 text-[13px] text-reject-400"
          >
            {error}
          </div>
        )}

        {answer && status && (
          <Panel className="animate-rise overflow-hidden">
            <PanelHeader
              title={status.label}
              hint={status.blurb}
              right={
                <div className="flex gap-2">
                  <Badge tone={answer.live ? "brand" : "neutral"}>
                    {answer.live ? "live model" : "lexical"}
                  </Badge>
                  <Badge tone={status.tone}>
                    {Math.round(answer.confidence * 100)}%
                  </Badge>
                </div>
              }
            />

            <div className="px-5 py-4">
              {answer.status === "NOT_FOUND" ? (
                <div className="rounded-xl border border-reject-400/25 bg-reject-400/[0.06] px-4 py-5">
                  <p className="text-[15px] font-semibold text-mist-100">
                    Not found in the provided sources.
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
                    {answer.caveat}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-mist-100">
                    {answer.answer}
                  </p>
                  {answer.caveat && (
                    <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-[13px] leading-relaxed text-mist-300">
                      {answer.caveat}
                    </p>
                  )}
                </>
              )}
            </div>

            {answer.citations.length > 0 && (
              <div className="border-t border-[var(--hairline)] px-5 py-4">
                <p className="strapline mb-3 text-[10px] text-mist-500">
                  Evidence ({answer.citations.length})
                </p>
                <ul className="space-y-3">
                  {answer.citations.map((c, i) => {
                    const source = excerptById.get(c.sourceId);
                    return (
                      <li
                        key={`${c.sourceId}-${i}`}
                        className="panel-flat overflow-hidden"
                      >
                        <div className="hair-x flex items-center gap-2.5 px-4 py-2.5">
                          <Badge tone="neutral">
                            {source ? SOURCE_CODE[source.kind] : "?"}
                          </Badge>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-mist-100">
                              {c.sourceTitle}
                            </p>
                            <p className="truncate font-mono text-[11px] text-mist-500">
                              {source ? SOURCE_LABEL[source.kind] : ""} ·{" "}
                              {c.locator}
                            </p>
                          </div>
                          <span className="ml-auto shrink-0 font-mono text-[10px] text-mist-600">
                            chars {c.start}–{c.end}
                          </span>
                        </div>
                        {source && (
                          <Excerpt
                            excerpt={source.excerpt}
                            start={c.start}
                            end={c.end}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
