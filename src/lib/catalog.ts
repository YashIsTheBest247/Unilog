/* ------------------------------------------------------------------ *
 * Catalog runner.
 *
 * Runs the whole bench through the pipeline and projects each result
 * down to something a browser can hold. The full EnrichedProduct
 * carries every source excerpt and every citation - fine for one SKU in
 * the console, far too heavy for twenty on a dashboard - so this module
 * keeps the attributes, the scores and the review queue, and drops the
 * evidence bodies.
 *
 * Memoised at module scope. The corpus is static, so a batch is
 * deterministic and there is no reason to pay for it twice.
 * ------------------------------------------------------------------ */

import { CATALOG, SEED_IDS, verifyProvenance } from "@/data/corpus";
import { enrich } from "@/lib/pipeline/run";
import { isLive } from "@/lib/llm";
import type {
  CommerceContent,
  CriticVerdict,
  GateDecision,
  QualityScore,
  RawProduct,
} from "@/lib/types";

export interface CatalogAttribute {
  key: string;
  label: string;
  group: string;
  value: string | null;
  unit?: string;
  decision: GateDecision;
  confidence: number;
  verdict: CriticVerdict;
  facetable: boolean;
  searchWeight: number;
  conflict: boolean;
}

export interface ReviewItem {
  sku: string;
  brand: string;
  mpn: string;
  key: string;
  label: string;
  value: string | null;
  confidence: number;
  reason: string;
  /** Competing values when the queue entry came from a disagreement. */
  contenders: string[];
}

export interface CatalogRecord {
  id: string;
  raw: RawProduct;
  classId: string;
  className: string;
  classPath: string[];
  unspsc: string;
  /** False when the SKU was derived from a parent's dimension table. */
  seed: boolean;
  attributes: CatalogAttribute[];
  commerce: CommerceContent;
  before: QualityScore;
  after: QualityScore;
  published: number;
  review: number;
  filled: number;
  requested: number;
  conflicts: number;
  refuted: number;
  sourceCount: number;
}

export interface CatalogSummary {
  skus: number;
  seeds: number;
  derived: number;
  attributesRequested: number;
  attributesFilled: number;
  published: number;
  review: number;
  conflicts: number;
  refuted: number;
  avgBefore: number;
  avgAfter: number;
  autoPublishRate: number;
  durationMs: number;
  live: boolean;
  provenance: { total: number; anchored: number };
  /** Distribution of post-enrichment quality scores, in bands of ten. */
  histogram: Array<{ band: string; count: number }>;
}

export interface CatalogResult {
  summary: CatalogSummary;
  records: CatalogRecord[];
  reviewQueue: ReviewItem[];
}

/** Seconds a reviewer needs per queued attribute, used for the ROI line. */
export const SECONDS_PER_REVIEW = 8;

let cached: Promise<CatalogResult> | null = null;

async function build(): Promise<CatalogResult> {
  const started = Date.now();
  const records: CatalogRecord[] = [];
  const reviewQueue: ReviewItem[] = [];

  for (const entry of CATALOG) {
    const product = await enrich(entry.raw);
    if (!product) continue;

    const specByKey = new Map(
      product.taxonomy.attributes.map((a) => [a.key, a]),
    );

    const attributes: CatalogAttribute[] = product.attributes.map((a) => {
      const spec = specByKey.get(a.key);
      return {
        key: a.key,
        label: a.label,
        group: a.group,
        value: a.value,
        unit: spec?.unit,
        decision: a.decision,
        confidence: a.confidence,
        verdict: a.verdict,
        facetable: spec?.facetable ?? false,
        searchWeight: spec?.searchWeight ?? 0,
        conflict: Boolean(a.conflict),
      };
    });

    for (const a of product.attributes) {
      if (a.decision !== "review") continue;
      reviewQueue.push({
        sku: product.raw.id,
        brand: product.raw.brand,
        mpn: product.raw.mpn,
        key: a.key,
        label: a.label,
        value: a.value,
        confidence: a.confidence,
        reason: a.conflict
          ? `Sources disagree; resolved on authority at ${Math.round(a.confidence * 100)}% confidence.`
          : a.criticNote,
        contenders:
          a.conflict?.contenders.map((c) => c.normalized ?? c.raw) ?? [],
      });
    }

    records.push({
      id: product.raw.id,
      raw: product.raw,
      classId: product.taxonomy.id,
      className: product.taxonomy.label,
      classPath: product.taxonomy.path,
      unspsc: product.taxonomy.unspsc,
      seed: SEED_IDS.has(product.raw.id),
      attributes,
      commerce: product.commerce,
      before: product.before,
      after: product.after,
      published: product.stats.published,
      review: product.stats.review,
      filled: product.stats.attributesFilled,
      requested: product.stats.attributesRequested,
      conflicts: product.stats.conflicts,
      refuted: product.stats.hallucinationsCaught,
      sourceCount: product.sources.length,
    });
  }

  const sum = (fn: (r: CatalogRecord) => number) =>
    records.reduce((acc, r) => acc + fn(r), 0);

  const published = sum((r) => r.published);
  const review = sum((r) => r.review);
  const filled = sum((r) => r.filled);

  const bands = [
    { band: "<60", count: 0 },
    { band: "60-69", count: 0 },
    { band: "70-79", count: 0 },
    { band: "80-89", count: 0 },
    { band: "90-99", count: 0 },
    { band: "100", count: 0 },
  ];

  for (const r of records) {
    const t = r.after.total;
    const idx =
      t >= 100 ? 5 : t < 60 ? 0 : Math.min(4, Math.floor((t - 50) / 10));
    bands[idx].count++;
  }

  return {
    summary: {
      skus: records.length,
      seeds: records.filter((r) => r.seed).length,
      derived: records.filter((r) => !r.seed).length,
      attributesRequested: sum((r) => r.requested),
      attributesFilled: filled,
      published,
      review,
      conflicts: sum((r) => r.conflicts),
      refuted: sum((r) => r.refuted),
      avgBefore: Math.round(sum((r) => r.before.total) / records.length),
      avgAfter: Math.round(sum((r) => r.after.total) / records.length),
      autoPublishRate: filled === 0 ? 0 : published / filled,
      durationMs: Date.now() - started,
      live: isLive(),
      provenance: verifyProvenance(),
      histogram: bands,
    },
    records,
    reviewQueue: reviewQueue.sort((a, b) => a.confidence - b.confidence),
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
