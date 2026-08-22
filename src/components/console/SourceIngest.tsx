"use client";

import { useRef, useState } from "react";
import { SOURCE_AUTHORITY, SOURCE_LABEL } from "@/lib/types";
import type { SourceKind, UserSource } from "@/lib/types";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/kit";
import { cn } from "@/lib/utils";
import { SOURCE_CODE } from "./AttributeTable";

export interface AttachedSource extends UserSource {
  id: string;
  pages?: number;
  truncated: boolean;
}

const KINDS: SourceKind[] = [
  "manufacturer_datasheet",
  "manufacturer_web",
  "catalog_pdf",
  "distributor_listing",
  "marketplace",
];

type Tab = "upload" | "url" | "paste";

export function SourceIngest({
  sources,
  onChange,
  disabled,
}: {
  sources: AttachedSource[];
  onChange: (next: AttachedSource[]) => void;
  disabled: boolean;
}) {
  const [tab, setTab] = useState<Tab>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function add(source: Omit<AttachedSource, "id">) {
    onChange([
      ...sources,
      { ...source, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ]);
  }

  async function submit(init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ingest", init);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "The document could not be read.");
      add(json.source);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files).slice(0, 4)) {
      const form = new FormData();
      form.append("file", file);
      await submit({ method: "POST", body: form });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleUrl() {
    if (!url.trim()) return;
    const ok = await submit({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    if (ok) setUrl("");
  }

  async function handlePaste() {
    if (!paste.trim()) return;
    const ok = await submit({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: paste,
        title: pasteTitle.trim() || "Pasted document",
      }),
    });
    if (ok) {
      setPaste("");
      setPasteTitle("");
    }
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Evidence"
        hint="Upload a datasheet, fetch a product page, or paste a spec block"
        right={
          sources.length > 0 ? (
            <Badge tone="brand">{sources.length} attached</Badge>
          ) : undefined
        }
      />

      {/* Tabs ----------------------------------------------------------- */}
      <div className="flex gap-1 px-5 pt-3">
        {(
          [
            ["upload", "Upload"],
            ["url", "From URL"],
            ["paste", "Paste text"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "focus-ring rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
              tab === id
                ? "bg-brand-500/15 text-brand-300"
                : "text-mist-400 tint-hover hover:text-mist-200",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-5 py-4">
        {tab === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!disabled) void handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "rounded-[10px] border border-dashed px-5 py-8 text-center transition-colors",
              dragging
                ? "border-brand-500 bg-brand-500/[0.08]"
                : "border-[var(--hairline-strong)]",
            )}
          >
            <p className="text-[13px] text-mist-300">
              Drop a PDF datasheet or catalog here
            </p>
            <p className="mt-1 text-[12px] text-mist-500">
              .pdf, .txt or .csv · up to 12 MB · text layer required
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv"
              multiple
              disabled={disabled || busy}
              onChange={(e) => void handleFiles(e.target.files)}
              className="sr-only"
              id="source-upload"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? "Reading…" : "Choose a file"}
            </Button>
          </div>
        )}

        {tab === "url" && (
          <div className="flex flex-wrap gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleUrl()}
              placeholder="https://manufacturer.example/products/77C-143-01"
              disabled={disabled || busy}
              className="focus-ring min-w-[16rem] flex-1 rounded-lg field px-3 py-2.5 font-mono text-[13px] text-mist-100 placeholder:text-mist-600 focus:border-brand-500"
            />
            <Button
              size="sm"
              disabled={disabled || busy || !url.trim()}
              onClick={() => void handleUrl()}
            >
              {busy ? "Fetching…" : "Fetch"}
            </Button>
            <p className="w-full text-[12px] text-mist-500">
              The page is fetched server-side and stripped to text. Client-side
              apps and blocked crawlers will not yield anything.
            </p>
          </div>
        )}

        {tab === "paste" && (
          <div className="space-y-2">
            <input
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="Document title (optional)"
              disabled={disabled || busy}
              className="focus-ring w-full rounded-lg field px-3 py-2 text-[13px] text-mist-100 placeholder:text-mist-600 focus:border-brand-500"
            />
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"Paste a specification block, a datasheet table, or a product page…"}
              rows={6}
              disabled={disabled || busy}
              className="focus-ring w-full resize-y rounded-lg field px-3 py-2.5 font-mono text-[12px] leading-relaxed text-mist-100 placeholder:text-mist-600 focus:border-brand-500"
            />
            <Button
              size="sm"
              disabled={disabled || busy || !paste.trim()}
              onClick={() => void handlePaste()}
            >
              Attach document
            </Button>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-reject-400/30 bg-reject-400/[0.08] px-3 py-2 text-[12px] text-reject-400"
          >
            {error}
          </p>
        )}
      </div>

      {/* Attached ------------------------------------------------------- */}
      {sources.length > 0 && (
        <ul className="divide-y divide-[var(--hairline)] border-t border-[var(--hairline)]">
          {sources.map((s) => (
            <li key={s.id} className="flex items-start gap-3 px-5 py-3">
              <Badge tone="neutral" className="mt-0.5 shrink-0">
                {SOURCE_CODE[s.kind]}
              </Badge>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-mist-100">
                  {s.title}
                </p>
                <p className="truncate font-mono text-[11px] text-mist-500">
                  {s.locator} · {s.text.length.toLocaleString()} chars
                  {s.truncated && " · truncated"}
                </p>

                <label className="mt-2 flex items-center gap-2">
                  <span className="strapline text-[10px] text-mist-500">
                    Treat as
                  </span>
                  <select
                    value={s.kind}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        sources.map((x) =>
                          x.id === s.id
                            ? { ...x, kind: e.target.value as SourceKind }
                            : x,
                        ),
                      )
                    }
                    className="focus-ring rounded border border-[var(--hairline)] bg-[var(--s-card)] px-2 py-1 text-[12px] text-mist-200"
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {SOURCE_LABEL[k]} ({SOURCE_AUTHORITY[k].toFixed(2)})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(sources.filter((x) => x.id !== s.id))}
                aria-label={`Remove ${s.title}`}
                className="focus-ring shrink-0 rounded px-2 py-1 text-[12px] text-mist-500 tint-hover hover:text-reject-400"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {sources.length > 0 && (
        <p className="border-t border-[var(--hairline)] px-5 py-3 text-[12px] leading-relaxed text-mist-500">
          Attached documents are machine-read. Values taken from them carry a
          confidence penalty and land in review unless another source
          corroborates them.
        </p>
      )}
    </Panel>
  );
}
