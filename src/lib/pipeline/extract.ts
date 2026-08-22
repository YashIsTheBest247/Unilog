/* ------------------------------------------------------------------ *
 * Stages 2 and 3 - Retrieve and Extract.
 *
 * Retrieval pulls the evidence pool and ranks it by source authority.
 * Extraction then walks every source against the class schema and emits
 * candidates - never values. A candidate is a claim plus the exact span
 * of the source that carries it, and the resolver later decides which
 * candidate becomes the published value. Keeping those two steps apart
 * is what makes conflicts visible instead of silently overwritten.
 * ------------------------------------------------------------------ */

import { findCorpusEntry } from "@/data/corpus";
import { structured, withFallback } from "@/lib/llm";
import { SOURCE_AUTHORITY } from "@/lib/types";
import type {
  EvidenceSource,
  RawProduct,
  TaxonomyClass,
  UserSource,
} from "@/lib/types";
import { heuristicClaims } from "./heuristic";

export interface Candidate {
  key: string;
  sourceId: string;
  authority: number;
  raw: string;
  quote: string;
  start: number;
  end: number;
  /** Read by the deterministic reader rather than a curator or a model. */
  heuristic?: boolean;
}

/* --------------------------------------------------------- retrieve */

export interface Retrieval {
  sources: EvidenceSource[];
  note: string;
}

/** Turn an operator-supplied document into an evidence source. */
function adopt(source: UserSource, index: number): EvidenceSource {
  return {
    id: `user-${index}-${source.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`,
    kind: source.kind,
    title: source.title,
    locator: source.locator,
    url: source.url,
    retrievedAt: "",
    excerpt: source.text,
    // Left empty on purpose. Extraction fills these, either with the
    // model or with the heuristic reader, so an uploaded document is
    // held to exactly the same citation rules as a cached one.
    claims: [],
  };
}

export function retrieve(
  raw: RawProduct,
  userSources: UserSource[] = [],
): Retrieval {
  const entry = findCorpusEntry(raw.mpn, raw.brand);
  const uploaded = userSources.map(adopt);
  const cached = entry?.sources ?? [];

  const sources = [...cached, ...uploaded].sort(
    (a, b) => SOURCE_AUTHORITY[b.kind] - SOURCE_AUTHORITY[a.kind],
  );

  if (sources.length === 0) {
    return {
      sources: [],
      note: `No evidence for ${raw.brand} ${raw.mpn}. Upload a datasheet, paste a URL, or pick a SKU from the demo bench.`,
    };
  }

  const top = sources[0];
  const provenance = [
    cached.length ? `${cached.length} cached` : null,
    uploaded.length ? `${uploaded.length} supplied` : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    sources,
    note: `${provenance} — ranked by authority; ${top.title} leads at ${SOURCE_AUTHORITY[top.kind].toFixed(2)}.`,
  };
}

/* ---------------------------------------------------------- extract */

/** Anchor a quote to its exact offsets so the UI can highlight it. */
function anchor(source: EvidenceSource, quote: string) {
  const start = source.excerpt.indexOf(quote);
  return start === -1
    ? { start: -1, end: -1 }
    : { start, end: start + quote.length };
}

function offlineExtract(
  cls: TaxonomyClass,
  sources: EvidenceSource[],
): Candidate[] {
  const allowed = new Set(cls.attributes.map((a) => a.key));
  const out: Candidate[] = [];

  for (const source of sources) {
    // A source with no annotations is something the operator supplied,
    // so read it with the heuristic extractor rather than skipping it.
    const machineRead = source.claims.length === 0;
    const claims = machineRead
      ? heuristicClaims(cls, source.excerpt)
      : source.claims;

    for (const claim of claims) {
      // A claim outside this class's schema is out of scope by definition.
      if (!allowed.has(claim.key)) continue;
      const { start, end } = anchor(source, claim.quote);
      out.push({
        key: claim.key,
        sourceId: source.id,
        authority: SOURCE_AUTHORITY[source.kind],
        raw: claim.raw,
        quote: claim.quote,
        start,
        end,
        heuristic: machineRead,
      });
    }
  }
  return out;
}

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "Attribute key from the schema." },
          value: {
            type: "string",
            description: "The value exactly as the source states it.",
          },
          quote: {
            type: "string",
            description:
              "A verbatim substring of the excerpt containing the value. Must match character for character.",
          },
        },
        required: ["key", "value", "quote"],
      },
    },
  },
  required: ["claims"],
} as const;

async function liveExtract(
  cls: TaxonomyClass,
  sources: EvidenceSource[],
): Promise<Candidate[]> {
  const schemaBlock = cls.attributes
    .map((a) => {
      const bits = [`${a.key} (${a.type}`];
      if (a.unit) bits.push(`, canonical unit ${a.unit}`);
      bits.push(`)`);
      const values = a.values ? ` allowed: ${a.values.join(" | ")}` : "";
      return `- ${bits.join("")} ${a.label}: ${a.description}${values}`;
    })
    .join("\n");

  const results = await Promise.all(
    sources.map(async (source) => {
      const result = await structured<{
        claims: Array<{ key: string; value: string; quote: string }>;
      }>({
        tier: "strong",
        maxTokens: 4096,
        system: [
          "You extract product attributes from industrial source documents.",
          "",
          "Hard rules:",
          "- Only emit attributes present in the supplied schema.",
          "- Only emit a value the excerpt actually states. Never infer, never complete a pattern, never use outside knowledge about the brand.",
          "- Every claim must carry a verbatim quote copied character for character from the excerpt.",
          "- If the excerpt does not state an attribute, omit it. A gap is a correct answer.",
          "- Report the value as the source writes it. Unit conversion happens downstream.",
        ].join("\n"),
        prompt: [
          `Product class: ${cls.label}`,
          "",
          "Attribute schema:",
          schemaBlock,
          "",
          `Source (${source.kind}): ${source.title}`,
          `Locator: ${source.locator}`,
          "",
          "Excerpt:",
          '"""',
          source.excerpt,
          '"""',
        ].join("\n"),
        schema: EXTRACT_SCHEMA as unknown as Record<string, unknown>,
      });

      const allowed = new Set(cls.attributes.map((a) => a.key));

      return result.claims
        .filter((c) => allowed.has(c.key))
        .map((c) => {
          const { start, end } = anchor(source, c.quote);
          return {
            key: c.key,
            sourceId: source.id,
            authority: SOURCE_AUTHORITY[source.kind],
            raw: c.value,
            quote: c.quote,
            start,
            end,
          } satisfies Candidate;
        })
        // A quote that does not anchor is an unverifiable citation, and an
        // unverifiable citation is worse than no value at all.
        .filter((c) => c.start !== -1);
    }),
  );

  return results.flat();
}

export async function extract(
  cls: TaxonomyClass,
  sources: EvidenceSource[],
): Promise<{ candidates: Candidate[]; live: boolean }> {
  if (sources.length === 0) return { candidates: [], live: false };

  const { value, live } = await withFallback(
    () => liveExtract(cls, sources),
    () => offlineExtract(cls, sources),
  );

  return { candidates: value, live };
}
