/* ------------------------------------------------------------------ *
 * Core domain types.
 *
 * The invariant this whole engine is built around: an attribute value
 * never travels without its evidence. Every AttributeValue carries the
 * source it came from, the exact span inside that source, how it was
 * derived, what the critic said about it, and what that adds up to as a
 * confidence score. Nothing downstream is allowed to strip that.
 * ------------------------------------------------------------------ */

export type AttributeType =
  | "enum"
  | "dimension"
  | "number"
  | "text"
  | "boolean";

export type UnitFamily = "length" | "pressure" | "temperature" | "mass" | "flow";

export interface AttributeSpec {
  key: string;
  label: string;
  group: string;
  type: AttributeType;
  /** Canonical unit the normalizer coerces every raw value into. */
  unit?: string;
  unitFamily?: UnitFamily;
  /** Allowed values for `enum` attributes, after normalization. */
  values?: string[];
  /** Inclusive numeric bounds used as a sanity check by the validator. */
  range?: [number, number];
  required: boolean;
  facetable: boolean;
  /** Relative contribution to search relevance, 0..1. */
  searchWeight: number;
  description: string;
}

export interface TaxonomyClass {
  id: string;
  label: string;
  /** Parent path, coarse to fine. */
  path: string[];
  unspsc: string;
  etim?: string;
  /** Words that pull an input row toward this class in demo mode. */
  signals: string[];
  attributes: AttributeSpec[];
}

/* ------------------------------------------------------------------ Evidence */

export type SourceKind =
  | "manufacturer_datasheet"
  | "manufacturer_web"
  | "catalog_pdf"
  | "distributor_listing"
  | "marketplace"
  | "product_image";

/** How far a source's word is trusted when two sources disagree. */
export const SOURCE_AUTHORITY: Record<SourceKind, number> = {
  manufacturer_datasheet: 1.0,
  manufacturer_web: 0.92,
  catalog_pdf: 0.84,
  distributor_listing: 0.66,
  product_image: 0.6,
  marketplace: 0.45,
};

export const SOURCE_LABEL: Record<SourceKind, string> = {
  manufacturer_datasheet: "Manufacturer datasheet",
  manufacturer_web: "Manufacturer web",
  catalog_pdf: "Catalog PDF",
  distributor_listing: "Distributor listing",
  marketplace: "Marketplace",
  product_image: "Product image",
};

/** A value a source asserts, pre-annotated so provenance spans are exact. */
export interface SourceClaim {
  key: string;
  raw: string;
  /** Verbatim substring of `excerpt` that carries the value. */
  quote: string;
}

export interface EvidenceSource {
  id: string;
  kind: SourceKind;
  title: string;
  /** Human locator: "p.4 · Table 2 · row 1/2-600-B". */
  locator: string;
  url: string;
  retrievedAt: string;
  excerpt: string;
  claims: SourceClaim[];
}

/** A document the operator supplied: uploaded, fetched or pasted. */
export interface UserSource {
  kind: SourceKind;
  title: string;
  locator: string;
  url: string;
  text: string;
}

/* ------------------------------------------------------------------ Values */

export type CriticVerdict = "SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED";
export type GateDecision = "publish" | "review" | "reject";

export type DerivationMethod =
  | "direct_quote"
  | "unit_conversion"
  | "enum_mapping"
  | "table_lookup"
  | "consensus"
  | "heuristic_read"
  | "inferred";

export interface Citation {
  sourceId: string;
  quote: string;
  /** Character offsets into the source excerpt. -1 when not located. */
  start: number;
  end: number;
}

export interface Conflict {
  /** Raw values as asserted, keyed by source. */
  contenders: Array<{ sourceId: string; raw: string; normalized: string | null }>;
  resolution: "unit_equivalent" | "authority" | "unresolved";
  note: string;
}

export interface AttributeValue {
  key: string;
  label: string;
  group: string;
  /** Normalized, publish-ready value. */
  value: string | null;
  unit?: string;
  /** Exactly what the source said, before normalization. */
  raw: string | null;
  method: DerivationMethod;
  citations: Citation[];
  verdict: CriticVerdict;
  criticNote: string;
  confidence: number;
  decision: GateDecision;
  conflict?: Conflict;
  /** Set when the normalizer or validator rejected the value outright. */
  validationError?: string;
}

/* ------------------------------------------------------------------ Product */

export interface RawProduct {
  id: string;
  mpn: string;
  brand: string;
  /** The ugly one-line description a distributor actually receives. */
  description: string;
  supplierCategory?: string;
  listPrice?: number;
  uom?: string;
}

/** A claim the critic killed. Kept so the run can show its work. */
export interface RefutedClaim {
  key: string;
  label: string;
  sourceId: string;
  raw: string;
  normalized: string | null;
  verdict: CriticVerdict;
  note: string;
  quote: string;
  start: number;
  end: number;
}

export interface CommerceContent {
  title: string;
  bullets: string[];
  metaDescription: string;
  synonyms: string[];
  applications: string[];
}

export interface QualityScore {
  total: number;
  completeness: number;
  verification: number;
  richness: number;
  searchability: number;
}

export interface EnrichedProduct {
  raw: RawProduct;
  taxonomy: TaxonomyClass;
  classificationConfidence: number;
  classificationRationale: string;
  attributes: AttributeValue[];
  /** Everything the critic rejected, in the order it was refuted. */
  refuted: RefutedClaim[];
  sources: EvidenceSource[];
  commerce: CommerceContent;
  before: QualityScore;
  after: QualityScore;
  stats: {
    attributesRequested: number;
    attributesFilled: number;
    published: number;
    review: number;
    rejected: number;
    conflicts: number;
    hallucinationsCaught: number;
    durationMs: number;
  };
  /** True when the run used the live model rather than the bundled corpus. */
  live: boolean;
}

/* ------------------------------------------------------------------ Trace */

export type StageId =
  | "classify"
  | "retrieve"
  | "extract"
  | "normalize"
  | "critique"
  | "resolve"
  | "gate"
  | "compose";

export const STAGE_ORDER: StageId[] = [
  "classify",
  "retrieve",
  "extract",
  "normalize",
  "critique",
  "resolve",
  "gate",
  "compose",
];

export const STAGE_LABEL: Record<StageId, string> = {
  classify: "Classify",
  retrieve: "Retrieve",
  extract: "Extract",
  normalize: "Normalize",
  critique: "Critique",
  resolve: "Resolve",
  gate: "Gate",
  compose: "Compose",
};

export const STAGE_NOTE: Record<StageId, string> = {
  classify: "taxonomy + attribute schema",
  retrieve: "authority-ranked evidence",
  extract: "schema-constrained, cited",
  normalize: "units, enums, ranges",
  critique: "adversarial refutation",
  resolve: "conflicts + confidence",
  gate: "publish / review / reject",
  compose: "SEO, synonyms, facets",
};

export type TraceEvent =
  | { type: "stage"; stage: StageId; status: "start" }
  | {
      type: "stage";
      stage: StageId;
      status: "done";
      ms: number;
      summary: string;
    }
  | { type: "log"; stage: StageId; message: string; tone?: "info" | "warn" | "good" }
  | { type: "result"; product: EnrichedProduct }
  | { type: "error"; message: string };
