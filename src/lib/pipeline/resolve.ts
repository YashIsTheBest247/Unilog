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

export function decide(confidence: number): GateDecision {
  if (confidence >= PUBLISH_THRESHOLD) return "publish";
  if (confidence >= REVIEW_THRESHOLD) return "review";
  return "reject";
}

export interface ResolveOutcome {
  attributes: AttributeValue[];
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
      Math.min(0.99, raw * CRITIC_MULTIPLIER[winner.verdict]),
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

  return { attributes, conflicts, hallucinationsCaught };
}
