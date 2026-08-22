/* ------------------------------------------------------------------ *
 * The workspace record.
 *
 * A full EnrichedProduct carries every source excerpt and every
 * citation - right for one SKU in the console, far too heavy to hold a
 * catalogue of. This is the projection everything else reads: the
 * attributes, the scores, the review queue, and nothing else.
 *
 * Deliberately pure and dependency-free of the pipeline, because both
 * the server and the browser build these. The browser needs to, since a
 * user's catalogue is whatever they have actually enriched, and that
 * lives in their workspace rather than in a fixture on the server.
 * ------------------------------------------------------------------ */

import type {
  CommerceContent,
  CriticVerdict,
  EnrichedProduct,
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
  /** True for the bundled sample catalogue, false for real work. */
  seed: boolean;
  /** When this record entered the workspace, ISO. */
  addedAt: string;
  attributes: CatalogAttribute[];
  review: ReviewItem[];
  commerce: CommerceContent;
  before: QualityScore;
  after: QualityScore;
  published: number;
  reviewCount: number;
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
  histogram: Array<{ band: string; count: number }>;
}

/** Seconds a reviewer needs per queued attribute, used for the ROI line. */
export const SECONDS_PER_REVIEW = 8;

export function toCatalogRecord(
  product: EnrichedProduct,
  options: { seed?: boolean; addedAt?: string } = {},
): CatalogRecord {
  const specByKey = new Map(product.taxonomy.attributes.map((a) => [a.key, a]));

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

  const review: ReviewItem[] = product.attributes
    .filter((a) => a.decision === "review")
    .map((a) => ({
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
    }));

  return {
    id: product.raw.id,
    raw: product.raw,
    classId: product.taxonomy.id,
    className: product.taxonomy.label,
    classPath: product.taxonomy.path,
    unspsc: product.taxonomy.unspsc,
    seed: options.seed ?? false,
    addedAt: options.addedAt ?? "",
    attributes,
    review,
    commerce: product.commerce,
    before: product.before,
    after: product.after,
    published: product.stats.published,
    reviewCount: product.stats.review,
    filled: product.stats.attributesFilled,
    requested: product.stats.attributesRequested,
    conflicts: product.stats.conflicts,
    refuted: product.stats.hallucinationsCaught,
    sourceCount: product.sources.length,
  };
}

export function summarize(
  records: CatalogRecord[],
  extra: Partial<Pick<CatalogSummary, "durationMs" | "live" | "provenance">> = {},
): CatalogSummary {
  const sum = (fn: (r: CatalogRecord) => number) =>
    records.reduce((acc, r) => acc + fn(r), 0);

  const published = sum((r) => r.published);
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

  const count = Math.max(1, records.length);

  return {
    skus: records.length,
    seeds: records.filter((r) => r.seed).length,
    derived: records.filter((r) => !r.seed).length,
    attributesRequested: sum((r) => r.requested),
    attributesFilled: filled,
    published,
    review: sum((r) => r.reviewCount),
    conflicts: sum((r) => r.conflicts),
    refuted: sum((r) => r.refuted),
    avgBefore: Math.round(sum((r) => r.before.total) / count),
    avgAfter: Math.round(sum((r) => r.after.total) / count),
    autoPublishRate: filled === 0 ? 0 : published / filled,
    durationMs: extra.durationMs ?? 0,
    live: extra.live ?? false,
    provenance: extra.provenance ?? { total: 0, anchored: 0 },
    histogram: bands,
  };
}

export function collectReviewQueue(records: CatalogRecord[]): ReviewItem[] {
  return records
    .flatMap((r) => r.review)
    .sort((a, b) => a.confidence - b.confidence);
}
