/* ------------------------------------------------------------------ *
 * Stages 4 and 5 - Normalize and Critique.
 *
 * Normalize coerces every candidate into the one canonical form its
 * spec demands, which is what turns "1/2 in", "DN 15" and "0.5" into a
 * single comparable value.
 *
 * Critique is the adversarial half, and it is the reason anything here
 * is publishable. A separate pass tries to REFUTE each candidate
 * against the evidence pool rather than confirm it, because a model
 * asked "is this right?" says yes. Three verdicts:
 *
 *   SUPPORTED    the cited span carries the value
 *   UNSUPPORTED  the citation does not actually establish it
 *   CONTRADICTED a more authoritative source states something else
 *
 * CONTRADICTED is where the hallucinations and the bad marketplace rows
 * die, and the count of them is the headline number of the whole run.
 * ------------------------------------------------------------------ */

import { structured, withFallback } from "@/lib/llm";
import { areEquivalent, normalizeValue } from "@/lib/units";
import type {
  AttributeSpec,
  CriticVerdict,
  EvidenceSource,
  TaxonomyClass,
} from "@/lib/types";
import type { Candidate } from "./extract";

export interface ScoredCandidate extends Candidate {
  normalized: string | null;
  converted: boolean;
  validationError?: string;
  verdict: CriticVerdict;
  criticNote: string;
}

/* -------------------------------------------------------- normalize */

export interface NormalizeOutcome {
  candidates: Array<Omit<ScoredCandidate, "verdict" | "criticNote">>;
  conversions: number;
  failures: number;
}

export function normalize(
  cls: TaxonomyClass,
  candidates: Candidate[],
): NormalizeOutcome {
  const specs = new Map(cls.attributes.map((a) => [a.key, a]));
  let conversions = 0;
  let failures = 0;

  const out = candidates.map((c) => {
    const spec = specs.get(c.key);
    if (!spec) {
      failures++;
      return {
        ...c,
        normalized: null,
        converted: false,
        validationError: `${c.key} is not part of the ${cls.label} schema`,
      };
    }

    const result = normalizeValue(spec, c.raw);
    if (result.converted) conversions++;
    if (result.value === null) failures++;

    return {
      ...c,
      normalized: result.value,
      converted: result.converted,
      validationError: result.error,
    };
  });

  return { candidates: out, conversions, failures };
}

/* --------------------------------------------------------- critique */

function groupByKey<T extends { key: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.key);
    if (list) list.push(item);
    else map.set(item.key, [item]);
  }
  return map;
}

function offlineCritique(
  cls: TaxonomyClass,
  normalized: NormalizeOutcome["candidates"],
): ScoredCandidate[] {
  const specs = new Map(cls.attributes.map((a) => [a.key, a]));
  const byKey = groupByKey(normalized);
  const out: ScoredCandidate[] = [];

  for (const [key, group] of byKey) {
    const spec = specs.get(key) as AttributeSpec | undefined;

    // The most authoritative candidate that actually normalized is the
    // yardstick everything else is measured against.
    const reference = [...group]
      .filter((c) => c.normalized !== null)
      .sort((a, b) => b.authority - a.authority)[0];

    for (const c of group) {
      if (c.normalized === null) {
        out.push({
          ...c,
          verdict: "UNSUPPORTED",
          criticNote:
            c.validationError ??
            "The value could not be coerced into the form this attribute requires.",
        });
        continue;
      }

      // Free text is phrasing, not data. "USA" and "United States" are
      // the same fact, and refuting one against the other buries the
      // contradictions that actually matter.
      if (
        spec &&
        spec.type !== "text" &&
        reference &&
        reference.sourceId !== c.sourceId &&
        reference.authority > c.authority &&
        !areEquivalent(spec, c.raw, reference.raw)
      ) {
        out.push({
          ...c,
          verdict: "CONTRADICTED",
          criticNote: `States "${c.normalized}", but a higher-authority source states "${reference.normalized}". Refuted.`,
        });
        continue;
      }

      out.push({
        ...c,
        verdict: "SUPPORTED",
        criticNote: c.converted
          ? `The cited span carries "${c.raw}", which normalizes to "${c.normalized}".`
          : "The cited span states this value directly.",
      });
    }
  }

  return out;
}

const CRITIC_SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", description: "Index of the candidate." },
          verdict: {
            type: "string",
            enum: ["SUPPORTED", "UNSUPPORTED", "CONTRADICTED"],
          },
          note: {
            type: "string",
            description: "One sentence. Say what refutes it, or what carries it.",
          },
        },
        required: ["index", "verdict", "note"],
      },
    },
  },
  required: ["verdicts"],
} as const;

async function liveCritique(
  cls: TaxonomyClass,
  normalized: NormalizeOutcome["candidates"],
  sources: EvidenceSource[],
): Promise<ScoredCandidate[]> {
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const listing = normalized
    .map((c, i) => {
      const src = sourceById.get(c.sourceId);
      return [
        `[${i}] ${c.key} = "${c.normalized ?? "(failed normalization)"}" (source states "${c.raw}")`,
        `     source: ${src?.kind} - ${src?.title} (authority ${c.authority.toFixed(2)})`,
        `     cited span: "${c.quote}"`,
        c.validationError ? `     normalizer said: ${c.validationError}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const result = await structured<{
    verdicts: Array<{ index: number; verdict: CriticVerdict; note: string }>;
  }>({
    tier: "strong",
    maxTokens: 4096,
    system: [
      "You are an adversarial validator for industrial product data. Your job is to REFUTE claims, not confirm them.",
      "",
      "For each candidate return one verdict:",
      "- CONTRADICTED: another, more authoritative source in this pool states something incompatible.",
      "- UNSUPPORTED: the cited span does not actually establish the value, or the value is implausible for this product class.",
      "- SUPPORTED: the cited span carries the value and nothing more authoritative disputes it.",
      "",
      "Default toward refutation when you are unsure. A value wrongly published is far more expensive than one wrongly sent to a human.",
      "Two values expressed in different units or phrasings that mean the same thing do NOT contradict each other.",
    ].join("\n"),
    prompt: [
      `Product class: ${cls.label}`,
      "",
      "Source authority scale: manufacturer datasheet 1.00 > manufacturer web 0.92 > catalog 0.84 > distributor 0.66 > marketplace 0.45.",
      "",
      "Candidates:",
      listing,
    ].join("\n"),
    schema: CRITIC_SCHEMA as unknown as Record<string, unknown>,
  });

  const byIndex = new Map(result.verdicts.map((v) => [v.index, v]));

  return normalized.map((c, i) => {
    const v = byIndex.get(i);
    return {
      ...c,
      verdict: v?.verdict ?? "UNSUPPORTED",
      criticNote: v?.note ?? "The critic returned no verdict for this candidate.",
    };
  });
}

export async function critique(
  cls: TaxonomyClass,
  normalized: NormalizeOutcome["candidates"],
  sources: EvidenceSource[],
): Promise<{ scored: ScoredCandidate[]; live: boolean }> {
  if (normalized.length === 0) return { scored: [], live: false };

  const { value, live } = await withFallback(
    () => liveCritique(cls, normalized, sources),
    () => offlineCritique(cls, normalized),
  );

  return { scored: value, live };
}
