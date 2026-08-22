"use client";

/* ------------------------------------------------------------------ *
 * The workspace.
 *
 * A user's catalogue is whatever they have actually enriched. Not a
 * fixture, not a demo set - the products they put through the engine.
 * Every downstream view (batch, search, compare, graph) reads from
 * here, so an empty workspace is an honest empty state rather than a
 * screen full of somebody else's data.
 *
 * Held in localStorage and computed in the browser. That keeps the
 * server stateless, which matters on serverless hosting where module
 * memory is per-instance and evaporates between requests - a
 * server-side store would appear to lose records at random.
 *
 * The bundled sample catalogue is still available, but only behind an
 * explicit action, and every record it adds is flagged `seed` so the UI
 * can keep saying which is which.
 * ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import type { CatalogRecord } from "./record";

const KEY = "unilog.workspace.v2";
const EVENT = "unilog:workspace";

/** Guards against a quota error or a full disk taking the page down. */
function read(): CatalogRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CatalogRecord[]) : [];
  } catch {
    return [];
  }
}

function write(records: CatalogRecord[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // Over quota. The in-memory state is still correct for this tab.
  }
  // Same-tab listeners; `storage` only fires in *other* tabs.
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useWorkspace() {
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setRecords(read());
    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /** Adds or replaces by id, newest first. */
  const save = useCallback((incoming: CatalogRecord | CatalogRecord[]) => {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    const stamped = list.map((r) => ({
      ...r,
      addedAt: r.addedAt || new Date().toISOString(),
    }));

    const current = read();
    const byId = new Map(current.map((r) => [r.id, r]));
    for (const r of stamped) byId.set(r.id, r);

    const next = [...byId.values()].sort((a, b) =>
      (b.addedAt ?? "").localeCompare(a.addedAt ?? ""),
    );
    write(next);
    setRecords(next);
    return next;
  }, []);

  const remove = useCallback((id: string) => {
    const next = read().filter((r) => r.id !== id);
    write(next);
    setRecords(next);
  }, []);

  const clear = useCallback(() => {
    write([]);
    setRecords([]);
  }, []);

  const clearSamples = useCallback(() => {
    const next = read().filter((r) => !r.seed);
    write(next);
    setRecords(next);
  }, []);

  /** Pulls the bundled sample catalogue in, flagged as samples. */
  const loadSamples = useCallback(async () => {
    const response = await fetch("/api/catalog");
    const json = await response.json();
    if (json.error) throw new Error(json.error);
    const samples: CatalogRecord[] = (json.records ?? []).map(
      (r: CatalogRecord) => ({ ...r, seed: true }),
    );
    return save(samples);
  }, [save]);

  return {
    records,
    ready,
    save,
    remove,
    clear,
    clearSamples,
    loadSamples,
    hasSamples: records.some((r) => r.seed),
    hasOwn: records.some((r) => !r.seed),
  };
}
