/* ------------------------------------------------------------------ *
 * Stages 6 and 7 - Resolve and Gate.
 *
 * Resolve picks one winner per attribute and, crucially, keeps the
 * losers. When two sources disagree the record does not quietly take
 * the better one - it records both, how the tie was broken and what
 * that cost in confidence.
 *
 * Confidence is assembled, not guessed:
 *
 *   base            authority of the winning source
 *   + corroboration +0.05 per independent agreeing source, capped
 *   - conflict      -0.14 when the tie was broken on authority alone
 *   x critic        SUPPORTED 1.0 | UNSUPPORTED 0.5 | CONTRADICTED 0.2
 *   x reader        0.88 when the value came from the heuristic reader
 *
 * That last factor is the point of the whole exercise. A document a
 * user just uploaded, read by pattern matching and corroborated by
 * nothing, cannot clear the publish bar on its own - it lands in review
 * at ~0.87. Give it one agreeing source and it clears. That is the
 * correct incentive: evidence, not confidence in the reader.
 *
 * Gate then turns that number into an operational decision. The
 * thresholds are the product: publish only what is defensible, send the
 * genuinely uncertain to a human, and drop the rest on the floor.
 * ------------------------------------------------------------------ */

import { areEquivalent } from "@/lib/units";
import type {
  AttributeValue,
  Conflict,
  DerivationMethod,
  GateDecision,
  RefutedClaim,
  TaxonomyClass,
} from "@/lib/types";
import type { ScoredCandidate } from "./validate";

export const PUBLISH_THRESHOLD = 0.92;
export const REVIEW_THRESHOLD = 0.6;

const CRITIC_MULTIPLIER: Record<ScoredCandidate["verdict"], number> = {
  SUPPORTED: 1,
  UNSUPPORTED: 0.5,
  CONTRADICTED: 0.2,
};

/** Machine-read values are held to a higher bar than curated ones. */
const HEURISTIC_MULTIPLIER = 0.88;

export function decide(confidence: number): GateDecision {
  if (confidence >= PUBLISH_THRESHOLD) return "publish";
  if (confidence >= REVIEW_THRESHOLD) return "review";
  return "reject";
}

export interface ResolveOutcome {
  attributes: AttributeValue[];
  refuted: RefutedClaim[];
  conflicts: number;
  hallucinationsCaught: number;
}

export function resolve(
  cls: TaxonomyClass,
  scored: ScoredCandidate[],
): ResolveOutcome {
  const byKey = new Map<string, ScoredCandidate[]>();
  for (const c of scored) {
    const list = byKey.get(c.key);
    if (list) list.push(c);
    else byKey.set(c.key, [c]);
  }

  let conflicts = 0;
  const hallucinationsCaught = scored.filter(
    (c) => c.verdict === "CONTRADICTED",
  ).length;

  const specByKey = new Map(cls.attributes.map((a) => [a.key, a]));

  // Everything the critic threw out, kept so the run can show its work.
  // Contradictions first - those are the ones that would have shipped.
  const refuted: RefutedClaim[] = scored
    .filter((c) => c.verdict !== "SUPPORTED")
    .sort((a, b) => {
      if (a.verdict !== b.verdict) return a.verdict === "CONTRADICTED" ? -1 : 1;
      return b.authority - a.authority;
    })
    .map((c) => ({
      key: c.key,
      label: specByKey.get(c.key)?.label ?? c.key,
      sourceId: c.sourceId,
      raw: c.raw,
      normalized: c.normalized,
      verdict: c.verdict,
      note: c.criticNote,
      quote: c.quote,
      start: c.start,
      end: c.end,
    }));

  const attributes: AttributeValue[] = cls.attributes.map((spec) => {
    const group = byKey.get(spec.key) ?? [];

    const usable = group
      .filter((c) => c.normalized !== null && c.verdict !== "CONTRADICTED")
      .sort(
        (a, b) =>
          b.authority * CRITIC_MULTIPLIER[b.verdict] -
          a.authority * CRITIC_MULTIPLIER[a.verdict],
      );

    const winner = usable[0];

    /* ---------------------------------------------------------- gaps */
    if (!winner) {
      const blocked = group.find((c) => c.verdict === "CONTRADICTED");
      return {
        key: spec.key,
        label: spec.label,
        group: spec.group,
        value: null,
        unit: spec.unit,
        raw: null,
        method: "inferred",
        citations: [],
        verdict: "UNSUPPORTED",
        criticNote: blocked
          ? "Every candidate for this attribute was refuted, so nothing was published."
          : "No source in the evidence pool asserts this attribute.",
        confidence: 0,
        decision: "reject",
        validationError: group.find((c) => c.validationError)?.validationError,
      } satisfies AttributeValue;
    }

    /* ------------------------------------------------------ agreement */
    const agreeing = usable.filter(
      (c) =>
        c.sourceId !== winner.sourceId &&
        areEquivalent(spec, c.raw, winner.raw),
    );

    // Text is free-form; two sources phrasing an approval list differently
    // is not a data conflict, so only typed attributes can disagree.
    const disputers =
      spec.type === "text"
        ? []
        : group.filter(
            (c) =>
              c.sourceId !== winner.sourceId &&
              c.normalized !== null &&
              !areEquivalent(spec, c.raw, winner.raw),
          );

    let conflict: Conflict | undefined;
    let conflictPenalty = 0;
    let method: DerivationMethod = winner.converted
      ? "unit_conversion"
      : "direct_quote";

    if (agreeing.length > 0 && !winner.converted) method = "consensus";
    if (winner.quote.includes("  ")) method = "table_lookup";
    if (winner.heuristic) method = "heuristic_read";

    if (disputers.length > 0) {
      conflicts++;
      conflictPenalty = 0.14;
      conflict = {
        contenders: [winner, ...disputers].map((c) => ({
          sourceId: c.sourceId,
          raw: c.raw,
          normalized: c.normalized,
        })),
        resolution: "authority",
        note: `${disputers.length + 1} sources disagree. Resolved to the value from the highest-authority source (${winner.authority.toFixed(2)}); the others were routed to the critic.`,
      };
    } else if (spec.type === "number" || spec.type === "dimension") {
      // Sources that agreed only after unit conversion are worth surfacing:
      // it is the difference between corroboration and coincidence. Enum
      // aliasing is not the same thing - "NPT" and "NPT Threaded" are one
      // value written two ways, not two units.
      const converted = [winner, ...agreeing].filter((c) => c.converted);
      if (converted.length > 0 && agreeing.length > 0) {
        conflict = {
          contenders: [winner, ...agreeing].map((c) => ({
            sourceId: c.sourceId,
            raw: c.raw,
            normalized: c.normalized,
          })),
          resolution: "unit_equivalent",
          note: "Sources stated this in different units. Normalization showed them to be the same value, so it counts as corroboration rather than a conflict.",
        };
      }
    }

    const corroboration = Math.min(0.12, agreeing.length * 0.05);
    const raw =
      winner.authority + corroboration - conflictPenalty;
    const confidence = Math.max(
      0,
      Math.min(
        0.99,
        raw *
          CRITIC_MULTIPLIER[winner.verdict] *
          (winner.heuristic ? HEURISTIC_MULTIPLIER : 1),
      ),
    );

    return {
      key: spec.key,
      label: spec.label,
      group: spec.group,
      value: winner.normalized,
      unit: spec.unit,
      raw: winner.raw,
      method,
      citations: [winner, ...agreeing].map((c) => ({
        sourceId: c.sourceId,
        quote: c.quote,
        start: c.start,
        end: c.end,
      })),
      verdict: winner.verdict,
      criticNote: winner.criticNote,
      confidence,
      decision: decide(confidence),
      conflict,
      validationError: winner.validationError,
    } satisfies AttributeValue;
  });

  return { attributes, refuted, conflicts, hallucinationsCaught };
}
