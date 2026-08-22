/* ------------------------------------------------------------------ *
 * Quality scoring.
 *
 * The before/after number is the only thing in this whole system a
 * merchandising manager will actually remember, so it has to be honest.
 * "Before" is not zero by decree - it is computed by running a naive
 * parser over the supplier row, crediting whatever a regex and an enum
 * lookup can genuinely recover. Usually that is two or three attributes
 * out of twenty, which is the real starting point.
 * ------------------------------------------------------------------ */

import { normalizeValue } from "@/lib/units";
import type {
  AttributeValue,
  QualityScore,
  RawProduct,
  TaxonomyClass,
} from "@/lib/types";

const WEIGHTS = {
  completeness: 0.4,
  verification: 0.25,
  richness: 0.2,
  searchability: 0.15,
};

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function assemble(parts: Omit<QualityScore, "total">): QualityScore {
  const total =
    parts.completeness * WEIGHTS.completeness +
    parts.verification * WEIGHTS.verification +
    parts.richness * WEIGHTS.richness +
    parts.searchability * WEIGHTS.searchability;

  return { ...parts, total: Math.round(total * 100) };
}

/**
 * What a plain parser can pull out of the supplier row with no evidence
 * pool at all. This is the honest baseline the "after" score is measured
 * against.
 */
export function naiveParse(
  raw: RawProduct,
  cls: TaxonomyClass,
): Set<string> {
  const text = `${raw.description} ${raw.supplierCategory ?? ""}`;
  const found = new Set<string>();

  // A leading fractional or decimal size is the one thing these rows
  // reliably carry.
  const sizeMatch = text.match(/(?:^|\s)(\d+(?:-\d+\/\d+)?|\d+\/\d+)(?:\s*(?:in|")|\s*X|\s)/i);
  if (sizeMatch) {
    const spec = cls.attributes.find((a) => a.key === "nominal_size");
    if (spec && normalizeValue(spec, sizeMatch[1]).value !== null) {
      found.add("nominal_size");
    }
  }

  // Enum attributes whose values or shop abbreviations appear literally.
  for (const spec of cls.attributes) {
    if (spec.type !== "enum" || !spec.values) continue;
    for (const token of text.split(/[\s,/]+/)) {
      if (token.length < 2) continue;
      if (normalizeValue(spec, token).value !== null) {
        found.add(spec.key);
        break;
      }
    }
  }

  return found;
}

export function scoreBefore(
  raw: RawProduct,
  cls: TaxonomyClass,
): QualityScore {
  const recovered = naiveParse(raw, cls);
  const required = cls.attributes.filter((a) => a.required);
  const facetable = cls.attributes.filter((a) => a.facetable);

  return assemble({
    completeness: ratio(
      required.filter((a) => recovered.has(a.key)).length,
      required.length,
    ),
    // Nothing in a raw supplier row is verified against anything.
    verification: 0,
    richness: ratio(recovered.size, cls.attributes.length),
    searchability: ratio(
      facetable.filter((a) => recovered.has(a.key)).length,
      facetable.length,
    ),
  });
}

/**
 * An attribute waiting on a human is not worth nothing.
 *
 * Scoring only what auto-published makes a single uploaded datasheet
 * look like a failure - every value machine-read from one uncorroborated
 * source lands in review, and the record scores near zero despite
 * carrying twenty correct attributes. Half credit says what is actually
 * true: the data is there, it is one signature away from publishable.
 */
const REVIEW_CREDIT = 0.5;

function credit(a: AttributeValue) {
  if (a.value === null) return 0;
  if (a.decision === "publish") return 1;
  if (a.decision === "review") return REVIEW_CREDIT;
  return 0;
}

export function scoreAfter(
  cls: TaxonomyClass,
  attributes: AttributeValue[],
  commerceAssets: number,
): QualityScore {
  const filled = attributes.filter((a) => a.value !== null);
  const byKey = new Map(attributes.map((a) => [a.key, a]));

  const required = cls.attributes.filter((a) => a.required);
  const facetable = cls.attributes.filter((a) => a.facetable);

  const creditFor = (key: string) => {
    const a = byKey.get(key);
    return a ? credit(a) : 0;
  };

  // Richness blends attribute coverage with the commerce assets composed
  // on top of it, since a record with no title is not commerce-ready
  // however many attributes it carries.
  const attributeRichness = ratio(
    attributes.reduce((sum, a) => sum + credit(a), 0),
    cls.attributes.length,
  );
  const assetRichness = Math.min(1, commerceAssets / 4);

  return assemble({
    completeness: ratio(
      required.reduce((sum, a) => sum + creditFor(a.key), 0),
      required.length,
    ),
    // Verification asks what the critic upheld, not what the gate let
    // through. A value held back for want of corroboration was still
    // verified against its source.
    verification: ratio(
      filled.filter((a) => a.verdict === "SUPPORTED").length,
      Math.max(filled.length, 1),
    ),
    richness: attributeRichness * 0.75 + assetRichness * 0.25,
    searchability: ratio(
      facetable.reduce((sum, a) => sum + creditFor(a.key), 0),
      facetable.length,
    ),
  });
}
