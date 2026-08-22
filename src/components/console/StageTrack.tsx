"use client";

import { STAGE_LABEL, STAGE_NOTE, STAGE_ORDER } from "@/lib/types";
import type { StageId } from "@/lib/types";
import type { LogLine, RunStatus, StageState } from "@/lib/useEnrichment";
import { cn } from "@/lib/utils";
import { Panel, PanelHeader, Badge } from "@/components/ui/kit";

function StageDot({ state }: { state: StageState }) {
  if (state.status === "done") {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-verify-400/40 bg-verify-400/15">
        <svg viewBox="0 0 12 12" className="size-3 text-verify-400" aria-hidden>
          <path
            d="M2 6.4 4.6 9 10 3.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (state.status === "running") {
    return (
      <span className="animate-pulse-ring grid size-6 shrink-0 place-items-center rounded-full border border-brand-500/60 bg-brand-500/20">
        <span className="size-2 rounded-full bg-brand-400" />
      </span>
    );
  }

  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-[var(--hairline)]">
      <span className="size-1.5 rounded-full bg-mist-500/50" />
    </span>
  );
}

export function StageTrack({
  stages,
  logs,
  status,
}: {
  stages: Record<StageId, StageState>;
  logs: LogLine[];
  status: RunStatus;
}) {
  const done = STAGE_ORDER.filter((s) => stages[s].status === "done").length;
  const totalMs = STAGE_ORDER.reduce((sum, s) => sum + (stages[s].ms ?? 0), 0);

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Pipeline trace"
        hint="Every stage leaves an auditable record"
        right={
          <Badge tone={status === "running" ? "brand" : done === 8 ? "verify" : "neutral"}>
            {done}/8 {totalMs > 0 ? `· ${totalMs}ms` : ""}
          </Badge>
        }
      />

      <ol className="divide-y divide-[var(--hairline)]">
        {STAGE_ORDER.map((id, i) => {
          const state = stages[id];
          const stageLogs = logs.filter((l) => l.stage === id);

          return (
            <li
              key={id}
              className={cn(
                "px-5 py-3.5 transition-colors",
                state.status === "running" && "bg-brand-500/[0.06]",
              )}
            >
              <div className="flex items-start gap-3">
                <StageDot state={state} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-brand-500/60">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold",
                        state.status === "pending"
                          ? "text-mist-500"
                          : "text-mist-100",
                      )}
                    >
                      {STAGE_LABEL[id]}
                    </span>
                    {state.ms !== undefined && (
                      <span className="ml-auto shrink-0 font-mono text-[11px] text-mist-500">
                        {state.ms}ms
                      </span>
                    )}
                  </div>

                  <p
                    className={cn(
                      "mt-0.5 text-[13px] leading-snug",
                      state.summary ? "text-mist-300" : "text-mist-500",
                    )}
                  >
                    {state.summary ?? STAGE_NOTE[id]}
                  </p>

                  {stageLogs.length > 0 && (
                    <ul className="mt-2 space-y-1 border-l border-[var(--hairline)] pl-3">
                      {stageLogs.map((l) => (
                        <li
                          key={l.id}
                          className={cn(
                            "animate-rise font-mono text-[11px] leading-relaxed",
                            l.tone === "warn"
                              ? "text-amber-400"
                              : l.tone === "good"
                                ? "text-verify-400"
                                : "text-mist-500",
                          )}
                        >
                          {l.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
