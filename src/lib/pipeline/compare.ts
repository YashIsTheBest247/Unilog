/* ------------------------------------------------------------------ *
 * Comparison copilot.
 *
 * Given a set of candidate products and a set of requirements, decide
 * which one to buy and say why.
 *
 * The distinction this whole module turns on is FAIL versus UNKNOWN. A
 * product that states 150 psi against a 600 psi requirement has failed.
 * A product whose pressure rating was never published has not failed -
 * nobody knows. Collapsing those two into one red cross is how a
 * comparison tool starts lying: it either rejects a product that might
 * be perfect, or silently promotes one nobody has verified.
 *
 * So an unknown never disqualifies, and it never counts as a pass. It
 * caps how confident the recommendation is allowed to be, and it is
 * named in the rationale.
 * ------------------------------------------------------------------ */

import { getClass } from "@/data/taxonomy";
import { normalizeValue, parseFractional } from "@/lib/units";
import type { AttributeSpec, TaxonomyClass } from "@/lib/types";
import type { CatalogRecord } from "@/lib/catalog";

export type Operator = "eq" | "gte" | "lte" | "oneOf";
export type Weight = "must" | "should";

export interface Requirement {
  key: string;
  label: string;
  op: Operator;
  /** Raw target, in whatever form the operator typed it. */
  value: string;
  weight: Weight;
  /** The words in the query this was read from, when parsed. */
  from?: string;
}

export type CellStatus = "pass" | "fail" | "unknown" | "unverified";

export interface Cell {
  status: CellStatus;
  /** The published value, or null when nothing was published. */
  actual: string | null;
  confidence: number;
  note: string;
}

export interface Candidate {
  id: string;
  mpn: string;
  brand: string;
  title: string;
  className: string;
  quality: number;
  cells: Record<string, Cell>;
  passes: number;
  fails: number;
  unknowns: number;
  disqualified: boolean;
  score: number;
}

export interface Comparison {
  requirements: Requirement[];
  candidates: Candidate[];
  winner: Candidate | null;
  runnerUp: Candidate | null;
  confidence: number;
  rationale: string[];
}

/* ------------------------------------------------------- evaluation */

function numeric(value: string): number | null {
  const direct = parseFractional(value.replace(/[^\d./\- ]/g, "").trim());
  return direct;
}

function compare(
  spec: AttributeSpec,
  requirement: Requirement,
  actual: string,
): { ok: boolean; note: string } {
  const target = normalizeValue(spec, requirement.value).value ?? requirement.value;

  if (requirement.op === "oneOf") {
    const options = requirement.value.split("|").map((v) => v.trim());
    const ok = options.some(
      (o) =>
        (normalizeValue(spec, o).value ?? o).toLowerCase() ===
        actual.toLowerCase(),
    );
    return {
      ok,
      note: ok
        ? `${actual} is one of ${options.join(", ")}`
        : `${actual} is not among ${options.join(", ")}`,
    };
  }

  if (requirement.op === "eq") {
    const ok = actual.toLowerCase() === String(target).toLowerCase();
    return {
      ok,
      note: ok ? `matches ${target}` : `${actual}, not ${target}`,
    };
  }

  const a = numeric(actual);
  const t = numeric(String(target));
  if (a === null || t === null) {
    return { ok: false, note: `${actual} cannot be compared numerically` };
  }

  const ok = requirement.op === "gte" ? a >= t : a <= t;
  const symbol = requirement.op === "gte" ? "≥" : "≤";
  return {
    ok,
    note: ok
      ? `${actual} ${symbol} ${target}`
      : `${actual} falls ${requirement.op === "gte" ? "short of" : "above"} ${target}`,
  };
}

function evaluate(
  cls: TaxonomyClass,
  record: CatalogRecord,
  requirement: Requirement,
): Cell {
  const spec = cls.attributes.find((a) => a.key === requirement.key);
  const attribute = record.attributes.find((a) => a.key === requirement.key);

  if (!spec || !attribute || attribute.value === null) {
    return {
      status: "unknown",
      actual: null,
      confidence: 0,
      note: "No source in the evidence pool states this attribute.",
    };
  }

  // A value the gate held back is not a fact yet. Treating it as one
  // would let unreviewed data decide a purchase.
  if (attribute.decision !== "publish") {
    const { ok } = compare(spec, requirement, attribute.value);
    return {
      status: "unverified",
      actual: attribute.value,
      confidence: attribute.confidence,
      note: `${attribute.value} is queued for review at ${Math.round(
        attribute.confidence * 100,
      )}% confidence, so it ${ok ? "would satisfy" : "would not satisfy"} this requirement but cannot be relied on.`,
    };
  }

  const { ok, note } = compare(spec, requirement, attribute.value);
  return {
    status: ok ? "pass" : "fail",
    actual: attribute.value,
    confidence: attribute.confidence,
    note,
  };
}

/* ---------------------------------------------------------- scoring */

const POINTS: Record<CellStatus, number> = {
  pass: 1,
  unverified: 0.35,
  unknown: 0,
  fail: 0,
};

export function runComparison(
  records: CatalogRecord[],
  requirements: Requirement[],
): Comparison {
  const candidates: Candidate[] = records.map((record) => {
    const cls = getClass(record.classId);
    const cells: Record<string, Cell> = {};

    let passes = 0;
    let fails = 0;
    let unknowns = 0;
    let score = 0;
    let disqualified = false;

    for (const requirement of requirements) {
      const cell = evaluate(cls, record, requirement);
      cells[requirement.key] = cell;

      if (cell.status === "pass") passes++;
      else if (cell.status === "fail") fails++;
      else unknowns++;

      // Only a stated, published value that misses the target removes a
      // product from consideration. An unknown leaves it in the running
      // and costs it confidence instead.
      if (cell.status === "fail" && requirement.weight === "must") {
        disqualified = true;
      }

      score +=
        POINTS[cell.status] * (requirement.weight === "must" ? 2 : 1);
    }

    // Data quality breaks ties between products that meet the same spec.
    score += record.after.total / 1000;

    return {
      id: record.id,
      mpn: record.raw.mpn,
      brand: record.raw.brand,
      title: record.commerce.title,
      className: record.className,
      quality: record.after.total,
      cells,
      passes,
      fails,
      unknowns,
      disqualified,
      score,
    };
  });

  const ranked = [...candidates].sort((a, b) => {
    if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1;
    return b.score - a.score;
  });

  const winner = ranked.find((c) => !c.disqualified) ?? null;
  const runnerUp = ranked.filter((c) => c !== winner)[0] ?? null;

  /* --------------------------------------------------- rationale */
  const rationale: string[] = [];
  let confidence = 0;

  if (!winner) {
    rationale.push(
      "No candidate satisfies every hard requirement. Relax a constraint or widen the candidate set.",
    );
  } else {
    const musts = requirements.filter((r) => r.weight === "must");
    const metMusts = musts.filter(
      (r) => winner.cells[r.key]?.status === "pass",
    );
    const unknownReqs = requirements.filter(
      (r) =>
        winner.cells[r.key]?.status === "unknown" ||
        winner.cells[r.key]?.status === "unverified",
    );

    rationale.push(
      `${winner.brand} ${winner.mpn} meets ${metMusts.length} of ${musts.length} hard requirements on published, verified data.`,
    );

    if (unknownReqs.length > 0) {
      rationale.push(
        `It is unverified on ${unknownReqs
          .map((r) => r.label.toLowerCase())
          .join(", ")}. That is a gap in the evidence, not a failure — confirm before ordering.`,
      );
    }

    if (runnerUp) {
      const runnerFails = requirements.filter(
        (r) => runnerUp.cells[r.key]?.status === "fail",
      );
      const runnerUnknowns = requirements.filter(
        (r) =>
          runnerUp.cells[r.key]?.status === "unknown" ||
          runnerUp.cells[r.key]?.status === "unverified",
      );

      if (runnerFails.length > 0) {
        rationale.push(
          `${runnerUp.mpn} was ranked below it because ${runnerFails
            .map((r) => `${r.label.toLowerCase()} is ${runnerUp.cells[r.key].actual}`)
            .join(" and ")}.`,
        );
      } else if (runnerUnknowns.length > 0) {
        rationale.push(
          `${runnerUp.mpn} matches on everything stated but lacks verified ${runnerUnknowns
            .map((r) => r.label.toLowerCase())
            .join(" and ")}.`,
        );
      }
    }

    // Confidence is the mean confidence of the cells that decided it,
    // with unknowns dragging it down rather than being ignored.
    const decided = requirements
      .map((r) => winner.cells[r.key])
      .filter(Boolean);
    const mean =
      decided.reduce((sum, c) => sum + (c.status === "pass" ? c.confidence : 0), 0) /
      Math.max(1, decided.length);
    confidence = Math.max(0, Math.min(0.99, mean));
  }

  return { requirements, candidates: ranked, winner, runnerUp, confidence, rationale };
}

/* ------------------------------------------------- query parsing */

const AT_LEAST = /\b(at least|minimum|min|over|above|greater than|>=|≥)\b/i;
const AT_MOST = /\b(at most|maximum|max|under|below|less than|<=|≤)\b/i;

/**
 * Turn a plain sentence into requirements.
 *
 * "3/4 inch stainless full port NPT ball valve rated at least 600 psi,
 * lead free" becomes five constraints. Enum attributes are matched
 * through the same alias table the extractor uses, so trade shorthand
 * works; numerics take their comparison direction from the words around
 * them, defaulting to "at least" because that is what a spec normally
 * means.
 */
export function requirementsFromQuery(
  cls: TaxonomyClass,
  query: string,
): Requirement[] {
  const lower = query.toLowerCase();
  const out: Requirement[] = [];

  /* Every span of the query may be claimed by exactly one attribute.
     Without this, "3/4 inch bronze ... 600 psi" spends "bronze" on both
     the body and the stem, spends "600 psi" on both the working and the
     steam rating, and leaks the "3" out of "3/4" into every unitless
     numeric in the schema. */
  const claimed: Array<[number, number]> = [];
  const isFree = (start: number, end: number) =>
    !claimed.some(([s, e]) => start < e && end > s);
  const claim = (start: number, end: number) => claimed.push([start, end]);

  /* Word spans, so n-grams can be rebuilt with real offsets. */
  const words: Array<{ text: string; start: number; end: number }> = [];
  for (const m of lower.matchAll(/[a-z0-9][a-z0-9/."'-]*/g)) {
    words.push({
      text: m[0],
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
    });
  }

  const UNIT_PATTERNS: Record<string, string> = {
    in: 'in\\b|inch(?:es)?|"',
    psi: "psi\\b|wog\\b|cwp\\b|bar\\b|#",
    F: "f\\b|deg|celsius|c\\b",
    lb: "lbs?\\b|kg\\b",
    Cv: "cv\\b",
  };

  // Required attributes claim their words first, then the ones a buyer
  // is most likely to be searching on.
  const ordered = [...cls.attributes].sort(
    (a, b) =>
      Number(b.required) - Number(a.required) || b.searchWeight - a.searchWeight,
  );

  for (const spec of ordered) {
    /* ------------------------------------------------------- enums */
    if (spec.type === "enum") {
      const hits: Array<{
        phrase: string;
        mapped: string;
        start: number;
        end: number;
      }> = [];

      for (let size = 1; size <= 4; size++) {
        for (let i = 0; i + size <= words.length; i++) {
          const first = words[i];
          const last = words[i + size - 1];
          if (!isFree(first.start, last.end)) continue;

          const phrase = lower.slice(first.start, last.end);
          if (phrase.length < 2) continue;

          // Bare figures are left in. "316" is a material and "150" is
          // a pressure class, and the normalizer now declines anything
          // ambiguous rather than guessing, so they are safe to offer.
          const mapped = normalizeValue(spec, phrase).value;
          if (mapped) {
            hits.push({ phrase, mapped, start: first.start, end: last.end });
          }
        }
      }

      if (hits.length === 0) continue;

      // Most specific value first, then the tightest span that produced
      // it. "bronze full port npt" resolves to Bronze just as "bronze"
      // does - but claiming all four words robs the port configuration
      // and the end connection of the words they needed.
      hits.sort(
        (a, b) =>
          b.mapped.split(" ").length - a.mapped.split(" ").length ||
          a.end - a.start - (b.end - b.start),
      );

      const best = hits[0];
      out.push({
        key: spec.key,
        label: spec.label,
        op: "eq",
        value: best.mapped,
        weight: spec.required ? "must" : "should",
        from: best.phrase,
      });
      claim(best.start, best.end);
      continue;
    }

    /* ---------------------------------------------------- booleans */
    if (spec.type === "boolean") {
      const cue = spec.label.toLowerCase().replace(/\([^)]*\)/g, "").trim();
      if (!cue) continue;
      const at = lower.indexOf(cue);
      if (at === -1 || !isFree(at, at + cue.length)) continue;

      const before = lower.slice(Math.max(0, at - 16), at);
      out.push({
        key: spec.key,
        label: spec.label,
        op: "eq",
        value: /\b(not|non|no)\b\s*$/.test(before) ? "No" : "Yes",
        weight: "must",
      });
      claim(at, at + cue.length);
      continue;
    }

    /* ---------------------------------------------------- numerics */
    if (spec.type !== "number" && spec.type !== "dimension") continue;

    // A figure only belongs to an attribute if it carries that
    // attribute's unit, or the attribute is named right beside it.
    // Anything looser and a bare "3" fills half the schema.
    const unitPattern = spec.unit ? UNIT_PATTERNS[spec.unit] : undefined;
    const cue = spec.label.toLowerCase().replace(/\([^)]*\)/g, "").trim();

    // Fraction forms first. With the bare integer leading the
    // alternation, "3/4 inch" is read as "3" and then "4 inch" - a
    // three-quarter inch valve silently becomes a four inch one.
    const number =
      /(?:^|[^a-z0-9/])(\d+\s*[-\s]\s*\d+\/\d+|\d+\/\d+|-?\d+(?:\.\d+)?)\s*([a-z"#]*)/gi;

    for (const m of lower.matchAll(number)) {
      const value = m[1];
      const unit = m[2] ?? "";
      const start = (m.index ?? 0) + m[0].indexOf(value);
      const end = start + value.length + (unit ? unit.length + 1 : 0);
      if (!isFree(start, end)) continue;

      const unitMatches =
        unitPattern && unit
          ? new RegExp(`^(?:${unitPattern})`, "i").test(unit)
          : false;

      const window = lower.slice(Math.max(0, start - 30), start);
      const cueNearby = cue.length > 2 && window.includes(cue.split(" ")[0]);

      if (!unitMatches && !cueNearby) continue;

      const raw = unit ? `${value} ${unit}` : value;
      if (normalizeValue(spec, raw).value === null) continue;

      const op: Operator = AT_MOST.test(window)
        ? "lte"
        : AT_LEAST.test(window)
          ? "gte"
          : spec.key === "nominal_size"
            ? "eq"
            : "gte";

      out.push({
        key: spec.key,
        label: spec.label,
        op,
        value: raw,
        weight: spec.required ? "must" : "should",
        from: raw,
      });
      claim(start, end);
      break;
    }
  }

  return out;
}
