/* ------------------------------------------------------------------ *
 * The orchestrator.
 *
 * Eight stages, run in order, emitting a trace as it goes. The trace is
 * not decoration - it is the audit log. Anyone asking "why does this
 * record say 2000 PSI?" gets the answer by replaying these events.
 *
 * Implemented as an async generator so the API route can stream each
 * stage the moment it lands rather than making the user watch a spinner
 * for the whole run.
 * ------------------------------------------------------------------ */

import { isLive } from "@/lib/llm";
import type {
  EnrichedProduct,
  RawProduct,
  TraceEvent,
  UserSource,
} from "@/lib/types";
import { classify } from "./classify";
import { compose } from "./compose";
import { extract, retrieve } from "./extract";
import { resolve } from "./resolve";
import { scoreAfter, scoreBefore } from "./score";
import { critique, normalize } from "./validate";

/** Keeps the stage visualisation legible when a stage returns instantly. */
const MIN_STAGE_MS = 220;

export interface RunOptions {
  /**
   * Pad fast stages so the console animation stays readable. Off for
   * batch work, where the padding would dominate the wall clock.
   */
  paced?: boolean;
  /** Documents the operator uploaded, fetched or pasted for this run. */
  userSources?: UserSource[];
}

export async function* runPipeline(
  raw: RawProduct,
  options: RunOptions = {},
): AsyncGenerator<TraceEvent> {
  const { paced = true, userSources = [] } = options;
  const runStarted = Date.now();
  let anyLive = false;

  async function pace(started: number) {
    const elapsed = Date.now() - started;
    if (paced && elapsed < MIN_STAGE_MS) {
      await new Promise((r) => setTimeout(r, MIN_STAGE_MS - elapsed));
    }
    return Math.max(elapsed, 1);
  }

  try {
    /* ------------------------------------------------ 1. classify */
    yield { type: "stage", stage: "classify", status: "start" };
    let t = Date.now();

    const classification = await classify(raw);
    anyLive ||= classification.live;
    const cls = classification.cls;

    yield {
      type: "log",
      stage: "classify",
      message: classification.rationale,
      tone: classification.confidence >= 0.75 ? "good" : "warn",
    };
    yield {
      type: "stage",
      stage: "classify",
      status: "done",
      ms: await pace(t),
      summary: `${cls.label} - ${cls.attributes.length} attributes required by this class`,
    };

    /* ------------------------------------------------ 2. retrieve */
    yield { type: "stage", stage: "retrieve", status: "start" };
    t = Date.now();

    const { sources, note } = retrieve(raw, userSources);

    if (sources.length === 0) {
      yield { type: "log", stage: "retrieve", message: note, tone: "warn" };
      yield {
        type: "error",
        message: `No evidence available for ${raw.brand} ${raw.mpn}. Upload a datasheet, paste a product URL, or choose a SKU from the demo bench — nothing can be published without a source.`,
      };
      return;
    }

    for (const s of sources) {
      yield {
        type: "log",
        stage: "retrieve",
        message: `${s.title} - ${s.locator}`,
      };
    }
    yield {
      type: "stage",
      stage: "retrieve",
      status: "done",
      ms: await pace(t),
      summary: note,
    };

    /* ------------------------------------------------- 3. extract */
    yield { type: "stage", stage: "extract", status: "start" };
    t = Date.now();

    const { candidates, live: extractLive } = await extract(cls, sources);
    anyLive ||= extractLive;

    const distinctKeys = new Set(candidates.map((c) => c.key)).size;
    yield {
      type: "stage",
      stage: "extract",
      status: "done",
      ms: await pace(t),
      summary: `${candidates.length} candidates across ${distinctKeys} of ${cls.attributes.length} attributes, every one carrying a cited span`,
    };

    /* ----------------------------------------------- 4. normalize */
    yield { type: "stage", stage: "normalize", status: "start" };
    t = Date.now();

    const normalized = normalize(cls, candidates);

    if (normalized.conversions > 0) {
      yield {
        type: "log",
        stage: "normalize",
        message: `${normalized.conversions} values coerced into canonical units or enum members.`,
        tone: "good",
      };
    }
    if (normalized.failures > 0) {
      yield {
        type: "log",
        stage: "normalize",
        message: `${normalized.failures} values failed validation and cannot be published as stated.`,
        tone: "warn",
      };
    }
    yield {
      type: "stage",
      stage: "normalize",
      status: "done",
      ms: await pace(t),
      summary: `${normalized.conversions} converted, ${normalized.failures} rejected by the validator`,
    };

    /* ------------------------------------------------ 5. critique */
    yield { type: "stage", stage: "critique", status: "start" };
    t = Date.now();

    const { scored, live: criticLive } = await critique(
      cls,
      normalized.candidates,
      sources,
    );
    anyLive ||= criticLive;

    const refuted = scored.filter((c) => c.verdict === "CONTRADICTED");
    for (const r of refuted) {
      yield {
        type: "log",
        stage: "critique",
        message: `${r.key}: ${r.criticNote}`,
        tone: "warn",
      };
    }
    yield {
      type: "stage",
      stage: "critique",
      status: "done",
      ms: await pace(t),
      summary: `${refuted.length} claims refuted, ${scored.filter((c) => c.verdict === "SUPPORTED").length} upheld`,
    };

    /* ------------------------------------------------- 6. resolve */
    yield { type: "stage", stage: "resolve", status: "start" };
    t = Date.now();

    const resolved = resolve(cls, scored);

    yield {
      type: "stage",
      stage: "resolve",
      status: "done",
      ms: await pace(t),
      summary: `${resolved.conflicts} conflicts resolved, confidence assembled for ${resolved.attributes.filter((a) => a.value !== null).length} attributes`,
    };

    /* ---------------------------------------------------- 7. gate */
    yield { type: "stage", stage: "gate", status: "start" };
    t = Date.now();

    const filled = resolved.attributes.filter((a) => a.value !== null);
    const publishCount = filled.filter((a) => a.decision === "publish").length;
    const reviewCount = filled.filter((a) => a.decision === "review").length;
    const rejectCount = filled.filter((a) => a.decision === "reject").length;

    if (reviewCount > 0) {
      yield {
        type: "log",
        stage: "gate",
        message: `${reviewCount} attributes fell short of the publish threshold and were queued for human review.`,
        tone: "warn",
      };
    }
    yield {
      type: "stage",
      stage: "gate",
      status: "done",
      ms: await pace(t),
      summary: `${publishCount} published, ${reviewCount} queued for review, ${rejectCount} rejected`,
    };

    /* ------------------------------------------------- 8. compose */
    yield { type: "stage", stage: "compose", status: "start" };
    t = Date.now();

    const { commerce, live: composeLive } = await compose(
      raw,
      cls,
      resolved.attributes,
    );
    anyLive ||= composeLive;

    yield {
      type: "stage",
      stage: "compose",
      status: "done",
      ms: await pace(t),
      summary: `Title, ${commerce.bullets.length} bullets and ${commerce.synonyms.length} trade synonyms composed from published attributes only`,
    };

    /* --------------------------------------------------- assemble */
    const before = scoreBefore(raw, cls);
    const after = scoreAfter(cls, resolved.attributes, [
      commerce.title,
      commerce.bullets.length ? "b" : "",
      commerce.metaDescription,
      commerce.synonyms.length ? "s" : "",
    ].filter(Boolean).length);

    const product: EnrichedProduct = {
      raw,
      taxonomy: cls,
      classificationConfidence: classification.confidence,
      classificationRationale: classification.rationale,
      attributes: resolved.attributes,
      refuted: resolved.refuted,
      sources,
      commerce,
      before,
      after,
      stats: {
        attributesRequested: cls.attributes.length,
        attributesFilled: filled.length,
        published: publishCount,
        review: reviewCount,
        rejected: rejectCount,
        conflicts: resolved.conflicts,
        hallucinationsCaught: resolved.hallucinationsCaught,
        durationMs: Date.now() - runStarted,
      },
      live: anyLive,
    };

    yield { type: "result", product };
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Non-streaming convenience wrapper, used by the batch runner. */
export async function enrich(raw: RawProduct): Promise<EnrichedProduct | null> {
  for await (const event of runPipeline(raw, { paced: false })) {
    if (event.type === "result") return event.product;
  }
  return null;
}

export { isLive };
