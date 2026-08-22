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

export function scoreAfter(
  cls: TaxonomyClass,
  attributes: AttributeValue[],
  commerceAssets: number,
): QualityScore {
  const publishable = attributes.filter(
    (a) => a.decision === "publish" && a.value !== null,
  );
  const filled = attributes.filter((a) => a.value !== null);

  const required = cls.attributes.filter((a) => a.required);
  const facetable = cls.attributes.filter((a) => a.facetable);
  const publishedKeys = new Set(publishable.map((a) => a.key));

  // Richness blends attribute coverage with the commerce assets composed
  // on top of it, since a record with no title is not commerce-ready
  // however many attributes it carries.
  const attributeRichness = ratio(publishable.length, cls.attributes.length);
  const assetRichness = Math.min(1, commerceAssets / 4);

  return assemble({
    completeness: ratio(
      required.filter((a) => publishedKeys.has(a.key)).length,
      required.length,
    ),
    verification: ratio(
      publishable.filter((a) => a.verdict === "SUPPORTED").length,
      Math.max(filled.length, 1),
    ),
    richness: attributeRichness * 0.75 + assetRichness * 0.25,
    searchability: ratio(
      facetable.filter((a) => publishedKeys.has(a.key)).length,
      facetable.length,
    ),
  });
}
