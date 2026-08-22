/* ------------------------------------------------------------------ *
 * Ask the datasheet.
 *
 * Grounded question answering over one product's evidence pool. The
 * whole value is in the failure case: when the documents do not contain
 * the answer, this says so. A confident paragraph about a pump that
 * cannot actually handle 80 C water is worse than no answer at all,
 * because someone will specify on it.
 *
 * Three outcomes, and only three:
 *
 *   ANSWERED     the sources state it, with the spans that do
 *   PARTIAL      the sources bear on it but do not settle it
 *   NOT_FOUND    nothing in the pool speaks to the question
 *
 * There is no fourth branch where the model reasons from what it knows
 * about the brand. Outside knowledge is the failure mode, not a feature.
 * ------------------------------------------------------------------ */

import { structured, withFallback } from "@/lib/llm";
import { SOURCE_AUTHORITY } from "@/lib/types";
import type { EvidenceSource } from "@/lib/types";

export type AnswerStatus = "ANSWERED" | "PARTIAL" | "NOT_FOUND";

export interface AnswerCitation {
  sourceId: string;
  sourceTitle: string;
  locator: string;
  quote: string;
  start: number;
  end: number;
}

export interface Answer {
  status: AnswerStatus;
  /** Plain language, one or two sentences. Empty when NOT_FOUND. */
  answer: string;
  /** What the operator should do when the sources fall short. */
  caveat: string | null;
  citations: AnswerCitation[];
  confidence: number;
  live: boolean;
}

/* --------------------------------------------------------- retrieval */

const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "can", "could",
  "will", "would", "should", "does", "do", "did", "has", "have", "had", "this",
  "that", "these", "those", "it", "its", "of", "in", "on", "at", "to", "for",
  "with", "and", "or", "but", "if", "how", "what", "when", "where", "which",
  "who", "why", "handle", "work", "use", "used", "about", "any", "all",
  "many", "much", "there", "valve", "product", "item", "unit",
]);

/**
 * A spec sheet answers "maximum operating temperature" with the words
 * "continuous service". Without this, a purely lexical matcher scores
 * the correct segment as a partial miss and hedges on an answer it
 * actually found.
 */
const SYNONYMS: Record<string, string[]> = {
  maximum: ["max", "highest", "upper"],
  minimum: ["min", "lowest", "lower"],
  operating: ["service", "working", "continuous", "operation"],
  temperature: ["temp"],
  pressure: ["psi", "wog", "cwp", "rating", "bar"],
  weight: ["mass", "lb", "kg"],
  size: ["nps", "nominal", "dn"],
  diameter: ["dia", "od"],
  material: ["construction", "body"],
  certified: ["listed", "approved", "conforms", "certification"],
  lead: ["nsf", "372"],
  free: ["nsf", "372"],
  potable: ["drinking", "nsf"],
  steam: ["wsp", "saturated"],
  thread: ["npt", "threaded"],
  flow: ["cv", "coefficient"],
  origin: ["made", "manufactured", "country"],
  standard: ["asme", "ansi", "api", "mss", "astm"],
};

export interface Term {
  term: string;
  variants: string[];
}

function terms(question: string): Term[] {
  const seen = new Set<string>();
  const out: Term[] = [];

  for (const token of question
    .toLowerCase()
    .replace(/[^a-z0-9/.\- ]+/g, " ")
    .split(/\s+/)) {
    if (token.length < 2 || STOP.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push({ term: token, variants: [token, ...(SYNONYMS[token] ?? [])] });
  }

  return out;
}

function matches(term: Term, haystack: string) {
  return term.variants.some((v) => haystack.includes(v));
}

export interface ScoredLine {
  sourceId: string;
  line: string;
  start: number;
  end: number;
  score: number;
  hits: string[];
}

interface Segment {
  text: string;
  start: number;
  end: number;
}

const TERMINAL = /[.:;!?]\s*$/;
const BARE_LABEL = /^[A-Z0-9 &/()-]{3,44}$/;

/** Three or more columns separated by runs of whitespace. */
function isTabular(text: string) {
  // An already-merged block counts as tabular so a table keeps growing.
  if (/\r?\n/.test(text)) return true;
  return text.split(/\s{2,}/).filter(Boolean).length >= 3;
}

/**
 * Split an excerpt into citable segments rather than raw lines.
 *
 * Raw lines are dangerous here, and not subtly. This excerpt:
 *
 *   This valve is not certified to NSF/ANSI 372 and should not be
 *   specified for potable water distribution.
 *
 * splits into a second line reading "specified for potable water
 * distribution." - which, cited on its own against "is this lead free
 * for potable water?", asserts the exact opposite of what the
 * manufacturer wrote. A wrapped sentence must be rejoined before
 * anything is allowed to quote it.
 *
 * The same merge handles the other half of the problem: a bare heading
 * like "TEMPERATURE RANGE" carries the question's words but none of the
 * answer, so it absorbs the line beneath it.
 */
function segments(excerpt: string): Segment[] {
  const raw: Segment[] = [];
  let cursor = 0;

  for (const line of excerpt.split("\n")) {
    const lead = line.length - line.trimStart().length;
    const text = line.trim();
    if (text.length > 0) {
      raw.push({
        text,
        start: cursor + lead,
        end: cursor + lead + text.length,
      });
    }
    cursor += line.length + 1;
  }

  const merged: Segment[] = [];
  let tableRows = 0;

  for (const seg of raw) {
    const previous = merged[merged.length - 1];

    if (previous) {
      const continues =
        !TERMINAL.test(previous.text) && /^[a-z(]/.test(seg.text);
      const completesLabel =
        BARE_LABEL.test(previous.text) &&
        previous.text === previous.text.toUpperCase() &&
        !/\d/.test(previous.text);

      // A dimension table is only meaningful whole. Citing the header
      // alone answers "how many bolt holes?" with the words "Holes" and
      // no number; citing a row alone gives a number with nothing
      // saying which column it is. They travel together.
      const bothTabular = isTabular(previous.text) && isTabular(seg.text);
      const joinsTable = bothTabular && tableRows < 8;

      if (joinsTable) tableRows++;
      else if (!continues && !completesLabel) tableRows = 0;

      if (continues || completesLabel || joinsTable) {
        // Span the original characters, newline included, so the quote
        // stays a literal substring of the excerpt.
        previous.text = excerpt.slice(previous.start, seg.end);
        previous.end = seg.end;
        continue;
      }
    }
    merged.push({ ...seg });
  }

  return merged;
}

/**
 * Rank every line in the pool against the question.
 *
 * Deliberately lexical rather than semantic: with no embedding service
 * this has to work offline, and on documents this dense - where the
 * answer is almost always a labelled row - term overlap is a strong
 * signal. Line offsets come straight from the excerpt, so a citation
 * highlights real characters.
 */
export function rankLines(
  sources: EvidenceSource[],
  question: string,
  limit = 12,
): ScoredLine[] {
  const wanted = terms(question);
  if (wanted.length === 0) return [];

  const scored: ScoredLine[] = [];

  for (const source of sources) {
    const authority = SOURCE_AUTHORITY[source.kind];

    for (const seg of segments(source.excerpt)) {
      if (seg.text.length < 3) continue;

      const lower = seg.text.toLowerCase();
      const hits = wanted.filter((t) => matches(t, lower)).map((t) => t.term);
      if (hits.length === 0) continue;

      // Longer terms are more discriminating than short ones, and a
      // segment packed with matches beats one that mentions a term in
      // passing inside a paragraph.
      const weight = hits.reduce((sum, t) => sum + Math.min(2, t.length / 4), 0);
      const density = hits.length / Math.max(4, seg.text.split(/\s+/).length);

      // Specification answers almost always carry a figure. A segment
      // with none is usually a heading or prose about the topic rather
      // than the value being asked for.
      const hasFigure = /\d/.test(seg.text) ? 1.3 : 0.7;

      scored.push({
        sourceId: source.id,
        line: seg.text,
        start: seg.start,
        end: seg.end,
        score: weight * (1 + density) * (0.6 + authority * 0.4) * hasFigure,
        hits,
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ----------------------------------------------------------- offline */

function offlineAnswer(
  sources: EvidenceSource[],
  question: string,
): Omit<Answer, "live"> {
  const wanted = terms(question);
  const ranked = rankLines(sources, question, 6);
  const byId = new Map(sources.map((s) => [s.id, s]));

  if (ranked.length === 0) {
    return {
      status: "NOT_FOUND",
      answer: "",
      caveat:
        "Nothing in the attached documents mentions this. Do not infer it from the product family - request the figure from the manufacturer.",
      citations: [],
      confidence: 0,
    };
  }

  const best = ranked[0];
  const covered = new Set(ranked.flatMap((r) => r.hits));
  const coverage = wanted.length === 0 ? 0 : covered.size / wanted.length;
  const bestCoverage =
    wanted.length === 0 ? 0 : best.hits.length / wanted.length;

  const citations: AnswerCitation[] = ranked.slice(0, 3).map((r) => {
    const source = byId.get(r.sourceId);
    return {
      sourceId: r.sourceId,
      sourceTitle: source?.title ?? r.sourceId,
      locator: source?.locator ?? "",
      quote: r.line,
      start: r.start,
      end: r.end,
    };
  });

  // One segment carrying most of the question, or near-total coverage
  // across the pool. Anything less hedges rather than asserts.
  const decisive =
    (bestCoverage >= 0.66 || coverage >= 0.85) &&
    best.hits.length >= Math.min(2, wanted.length);

  // When a low-authority listing outranks the manufacturer's own
  // documents, say so. This corpus contains a distributor claiming eight
  // bolt holes on a four-hole flange, and a reader deserves the warning.
  const topAuthority = SOURCE_AUTHORITY[
    byId.get(best.sourceId)?.kind ?? "distributor_listing"
  ];
  const betterExists = sources.some((s) => SOURCE_AUTHORITY[s.kind] > topAuthority);
  const authorityWarning =
    topAuthority < 0.9 && betterExists
      ? `The closest match came from a ${byId.get(best.sourceId)?.kind.replace(/_/g, " ")} (authority ${topAuthority.toFixed(2)}). Check it against the manufacturer document before relying on it.`
      : null;

  return {
    status: decisive ? "ANSWERED" : "PARTIAL",
    answer: decisive
      ? `The documents state: “${best.line}”`
      : `The documents touch on this but do not settle it. The closest statement is: “${best.line}”`,
    caveat:
      authorityWarning ??
      (decisive
        ? null
        : `Only ${covered.size} of ${wanted.length} terms in the question are matched anywhere in the pool. Treat this as a lead, not a settled answer.`),
    citations,
    confidence: Math.min(
      0.95,
      Math.max(coverage, bestCoverage) * (0.6 + topAuthority * 0.4),
    ),
  };
}

/* -------------------------------------------------------------- live */

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["ANSWERED", "PARTIAL", "NOT_FOUND"],
      description:
        "ANSWERED only when the excerpts state it outright. NOT_FOUND when they do not speak to it at all.",
    },
    answer: {
      type: "string",
      description:
        "One or two plain sentences. Empty string when the status is NOT_FOUND.",
    },
    caveat: {
      type: "string",
      description:
        "What the reader must check before relying on this. Empty when the answer is unambiguous.",
    },
    quotes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sourceId: { type: "string" },
          quote: {
            type: "string",
            description:
              "Verbatim substring of that source's excerpt, character for character.",
          },
        },
        required: ["sourceId", "quote"],
      },
    },
    confidence: { type: "number", description: "0 to 1. Be calibrated." },
  },
  required: ["status", "answer", "caveat", "quotes", "confidence"],
} as const;

async function liveAnswer(
  sources: EvidenceSource[],
  question: string,
): Promise<Omit<Answer, "live">> {
  const byId = new Map(sources.map((s) => [s.id, s]));

  const corpus = sources
    .map((s) =>
      [
        `### sourceId: ${s.id}`,
        `kind: ${s.kind} (authority ${SOURCE_AUTHORITY[s.kind].toFixed(2)})`,
        `title: ${s.title}`,
        `locator: ${s.locator}`,
        "excerpt:",
        '"""',
        s.excerpt,
        '"""',
      ].join("\n"),
    )
    .join("\n\n");

  const result = await structured<{
    status: AnswerStatus;
    answer: string;
    caveat: string;
    quotes: Array<{ sourceId: string; quote: string }>;
    confidence: number;
  }>({
    tier: "strong",
    maxTokens: 1500,
    system: [
      "You answer questions about industrial products using ONLY the supplied document excerpts.",
      "",
      "Hard rules:",
      "- Never use knowledge about the brand, the product family, or engineering practice. If the excerpts do not say it, you do not know it.",
      "- NOT_FOUND is a correct and valuable answer. Prefer it to a plausible guess.",
      "- Use PARTIAL when the excerpts bear on the question but do not settle it, and say precisely what is missing.",
      "- Every quote must be a verbatim substring of the excerpt you took it from, character for character.",
      "- Where a specification is a limit, say so plainly. An operator will specify equipment on this answer.",
    ].join("\n"),
    prompt: [
      `Question: ${question}`,
      "",
      "Documents:",
      corpus,
    ].join("\n"),
    schema: ANSWER_SCHEMA as unknown as Record<string, unknown>,
  });

  const citations: AnswerCitation[] = result.quotes
    .map((q) => {
      const source = byId.get(q.sourceId);
      if (!source) return null;
      const start = source.excerpt.indexOf(q.quote);
      // An unanchored quote is an unverifiable citation, so it is dropped
      // rather than shown as if it could be checked.
      if (start === -1) return null;
      return {
        sourceId: q.sourceId,
        sourceTitle: source.title,
        locator: source.locator,
        quote: q.quote,
        start,
        end: start + q.quote.length,
      };
    })
    .filter((c): c is AnswerCitation => c !== null);

  // A claimed answer with no citation that survived anchoring is not an
  // answer this system is willing to make.
  const status: AnswerStatus =
    result.status !== "NOT_FOUND" && citations.length === 0
      ? "PARTIAL"
      : result.status;

  return {
    status,
    answer: status === "NOT_FOUND" ? "" : result.answer,
    caveat:
      result.caveat?.trim()
        ? result.caveat.trim()
        : citations.length === 0 && status !== "NOT_FOUND"
          ? "No quote from the documents could be verified for this answer."
          : null,
    citations,
    confidence: Math.max(0, Math.min(1, result.confidence)),
  };
}

export async function ask(
  sources: EvidenceSource[],
  question: string,
): Promise<Answer> {
  if (sources.length === 0) {
    return {
      status: "NOT_FOUND",
      answer: "",
      caveat: "There are no documents attached to this product to read.",
      citations: [],
      confidence: 0,
      live: false,
    };
  }

  const { value, live } = await withFallback(
    () => liveAnswer(sources, question),
    () => offlineAnswer(sources, question),
  );

  return { ...value, live };
}
