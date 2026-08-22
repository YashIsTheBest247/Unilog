"use client";

import { useCallback, useRef, useState } from "react";
import { STAGE_ORDER } from "./types";
import type {
  EnrichedProduct,
  RawProduct,
  StageId,
  TraceEvent,
  UserSource,
} from "./types";

export interface StageState {
  status: "pending" | "running" | "done";
  ms?: number;
  summary?: string;
}

export interface LogLine {
  id: number;
  stage: StageId;
  message: string;
  tone: "info" | "warn" | "good";
}

export type RunStatus = "idle" | "running" | "done" | "error";

function blankStages(): Record<StageId, StageState> {
  return Object.fromEntries(
    STAGE_ORDER.map((s) => [s, { status: "pending" as const }]),
  ) as Record<StageId, StageState>;
}

export interface EnrichmentInput {
  mpn: string;
  brand: string;
  description: string;
  supplierCategory?: string;
  /** Documents the operator uploaded, fetched or pasted for this run. */
  sources?: UserSource[];
}

/**
 * Consumes the trace stream from /api/enrich.
 *
 * EventSource cannot POST, so the stream is read off the fetch body by
 * hand. Each stage is committed to state the moment its event lands,
 * which is the whole point of streaming it - the operator watches the
 * pipeline think rather than a spinner.
 */
export function useEnrichment() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [stages, setStages] = useState<Record<StageId, StageState>>(blankStages);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [product, setProduct] = useState<EnrichedProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<RawProduct | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const logId = useRef(0);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setStages(blankStages());
    setLogs([]);
    setProduct(null);
    setError(null);
    setInput(null);
  }, []);

  const apply = useCallback((event: TraceEvent) => {
    switch (event.type) {
      case "stage":
        setStages((prev) => ({
          ...prev,
          [event.stage]:
            event.status === "start"
              ? { status: "running" }
              : { status: "done", ms: event.ms, summary: event.summary },
        }));
        break;

      case "log":
        setLogs((prev) => [
          ...prev,
          {
            id: logId.current++,
            stage: event.stage,
            message: event.message,
            tone: event.tone ?? "info",
          },
        ]);
        break;

      case "result":
        setProduct(event.product);
        setStatus("done");
        break;

      case "error":
        setError(event.message);
        setStatus("error");
        break;
    }
  }, []);

  const run = useCallback(
    async (payload: EnrichmentInput) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      logId.current = 0;
      setStatus("running");
      setStages(blankStages());
      setLogs([]);
      setProduct(null);
      setError(null);
      setInput({ id: "pending", ...payload });

      try {
        const response = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => null);
          throw new Error(
            detail?.error ?? `The enrichment request failed (${response.status}).`,
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line.
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!line) continue;
            const body = line.slice(6);
            if (!body || body === "{}") continue;
            try {
              apply(JSON.parse(body) as TraceEvent);
            } catch {
              // A truncated frame is not worth tearing the run down for.
            }
          }
        }

        setStatus((s) => (s === "running" ? "done" : s));
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [apply],
  );

  return { status, stages, logs, product, error, input, run, reset };
}
