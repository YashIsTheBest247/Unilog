/* ------------------------------------------------------------------ *
 * Sample catalogue runner.
 *
 * This is no longer what the app reads. A user's catalogue is whatever
 * they have actually enriched, held in their workspace - see
 * lib/workspace.ts. What lives here is the bundled sample set, offered
 * behind an explicit action so somebody can see the whole system
 * working before they have uploaded anything of their own.
 *
 * Memoised at module scope: the corpus is static, so a run is
 * deterministic and there is no reason to pay for it twice.
 * ------------------------------------------------------------------ */

import { CATALOG, verifyProvenance } from "@/data/corpus";
import { isLive } from "@/lib/llm";
import { enrich } from "@/lib/pipeline/run";
import { summarize, toCatalogRecord } from "@/lib/record";
import type { CatalogRecord, CatalogSummary, ReviewItem } from "@/lib/record";

export type {
  CatalogAttribute,
  CatalogRecord,
  CatalogSummary,
  ReviewItem,
} from "@/lib/record";
export { SECONDS_PER_REVIEW } from "@/lib/record";

export interface CatalogResult {
  summary: CatalogSummary;
  records: CatalogRecord[];
  reviewQueue: ReviewItem[];
}

let cached: Promise<CatalogResult> | null = null;

async function build(): Promise<CatalogResult> {
  const started = Date.now();
  const records: CatalogRecord[] = [];

  for (const entry of CATALOG) {
    const product = await enrich(entry.raw);
    if (!product) continue;
    // Everything out of the bundled corpus is sample data, whether it
    // was hand-authored or derived from a datasheet table.
    records.push(toCatalogRecord(product, { seed: true }));
  }

  const summary = summarize(records, {
    durationMs: Date.now() - started,
    live: isLive(),
    provenance: verifyProvenance(),
  });

  return {
    summary,
    records,
    reviewQueue: records
      .flatMap((r) => r.review)
      .sort((a, b) => a.confidence - b.confidence),
  };
}

export function runCatalog(): Promise<CatalogResult> {
  cached ??= build().catch((err) => {
    // Never cache a failure - the next request deserves a fresh attempt.
    cached = null;
    throw err;
  });
  return cached;
}
