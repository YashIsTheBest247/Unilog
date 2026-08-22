/* ------------------------------------------------------------------ *
 * Stage 1 - Classify.
 *
 * Everything downstream depends on this call. The class chosen here
 * decides which attributes are required, which units apply and which
 * values are legal, so a misclassification is not a small error - it
 * silently invalidates the whole record.
 * ------------------------------------------------------------------ */

import { TAXONOMY, getClass } from "@/data/taxonomy";
import { structured, withFallback } from "@/lib/llm";
import type { RawProduct, TaxonomyClass } from "@/lib/types";

export interface Classification {
  cls: TaxonomyClass;
  confidence: number;
  rationale: string;
  live: boolean;
}

function haystack(raw: RawProduct) {
  return [raw.description, raw.supplierCategory ?? "", raw.mpn, raw.brand]
    .join(" ")
    .toLowerCase();
}

/** Signal scoring over the raw row - the fallback, and the tie-breaker. */
function scoreClasses(raw: RawProduct) {
  const text = haystack(raw);

  return TAXONOMY.map((cls) => {
    const hits = cls.signals.filter((s) => text.includes(s));
    // Longer signals are more specific, so they count for more.
    const weight = hits.reduce((sum, s) => sum + Math.min(1, s.length / 8), 0);
    return { cls, hits, score: weight };
  }).sort((a, b) => b.score - a.score);
}

function offlineClassify(raw: RawProduct): Omit<Classification, "live"> {
  const ranked = scoreClasses(raw);
  const top = ranked[0];
  const runnerUp = ranked[1];

  if (!top || top.score === 0) {
    return {
      cls: TAXONOMY[0],
      confidence: 0.25,
      rationale:
        "No taxonomy signal matched the supplier row; defaulted to the first class. This record should be classified by hand.",
    };
  }

  const margin = top.score - (runnerUp?.score ?? 0);
  const confidence = Math.min(0.99, 0.62 + margin * 0.16 + top.score * 0.05);

  return {
    cls: top.cls,
    confidence,
    rationale: `Matched ${top.hits.map((h) => `"${h}"`).join(", ")} in the supplier description and category, which is distinctive to ${top.cls.label}.`,
  };
}

const SCHEMA = {
  type: "object",
  properties: {
    classId: {
      type: "string",
      enum: TAXONOMY.map((t) => t.id),
      description: "The taxonomy class id this product belongs to.",
    },
    confidence: {
      type: "number",
      description: "0 to 1. Be honest; a low score routes to a human.",
    },
    rationale: {
      type: "string",
      description:
        "One sentence citing the specific tokens in the supplier row that decided it.",
    },
  },
  required: ["classId", "confidence", "rationale"],
} as const;

export async function classify(raw: RawProduct): Promise<Classification> {
  const { value, live } = await withFallback<Omit<Classification, "live">>(
    async () => {
      const result = await structured<{
        classId: string;
        confidence: number;
        rationale: string;
      }>({
        tier: "fast",
        maxTokens: 512,
        system:
          "You classify industrial PVF products into a fixed taxonomy. Supplier descriptions are heavily abbreviated trade shorthand. Choose the single best class and be calibrated about confidence.",
        prompt: [
          "Classify this supplier row.",
          "",
          `MPN: ${raw.mpn}`,
          `Brand: ${raw.brand}`,
          `Description: ${raw.description}`,
          `Supplier category: ${raw.supplierCategory ?? "(none)"}`,
          "",
          "Available classes:",
          ...TAXONOMY.map((t) => `- ${t.id}: ${t.label} (${t.path.join(" > ")})`),
        ].join("\n"),
        schema: SCHEMA as unknown as Record<string, unknown>,
      });

      return {
        cls: getClass(result.classId),
        confidence: Math.max(0, Math.min(1, result.confidence)),
        rationale: result.rationale,
      };
    },
    () => offlineClassify(raw),
  );

  return { ...value, live };
}
