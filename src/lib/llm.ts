/* ------------------------------------------------------------------ *
 * Model access.
 *
 * Provider-agnostic by design. The pipeline only ever asks for
 * `structured<T>()` - a schema in, validated JSON out - so swapping the
 * model behind it changes nothing upstream. Gemini and Anthropic are
 * both wired up; whichever key is present wins, and Gemini takes
 * precedence when both are set.
 *
 * Two rules govern this file.
 *
 * 1. The engine must run without a key. Every call site has a
 *    deterministic fallback over the bundled corpus, so the app deploys,
 *    demos and scores identically with an empty environment.
 * 2. A model failure is never fatal. Anything thrown here is caught by
 *    the caller and downgraded to the deterministic path, with the run
 *    marked `live: false` so the UI can say so honestly. A wrong model
 *    id or a dead key degrades the output; it does not break the app.
 *
 * Model tiering is deliberate: classification and normalization are
 * cheap, high-volume decisions and go to the fast model; extraction and
 * critique are the judgement calls and go to the strong one. At two
 * million SKUs that difference is the whole operating cost.
 * ------------------------------------------------------------------ */

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export type Provider = "gemini" | "anthropic";

const GEMINI_STRONG = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
const GEMINI_FAST = process.env.GEMINI_FAST_MODEL || "gemini-3.7-flash";

const ANTHROPIC_STRONG = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const ANTHROPIC_FAST =
  process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-4-5-20251001";

export function activeProvider(): Provider | null {
  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  if (forced === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (forced === "anthropic") {
    return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  }
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function isLive(): boolean {
  return activeProvider() !== null;
}

let gemini: GoogleGenAI | null = null;
let anthropic: Anthropic | null = null;

export interface StructuredCall {
  /** Which tier to bill this call to. */
  tier: "fast" | "strong";
  system: string;
  prompt: string;
  /** JSON Schema the model is forced to emit. */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

/* ---------------------------------------------------------- Gemini */

async function structuredGemini<T>(call: StructuredCall): Promise<T> {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await gemini.models.generateContent({
    model: call.tier === "fast" ? GEMINI_FAST : GEMINI_STRONG,
    contents: call.prompt,
    config: {
      systemInstruction: call.system,
      // Standard JSON Schema, so the pipeline's schemas pass through
      // untouched rather than being translated into a dialect.
      responseMimeType: "application/json",
      responseJsonSchema: call.schema,
      maxOutputTokens: call.maxTokens ?? 4096,
      temperature: 0,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned no content");

  try {
    return JSON.parse(text) as T;
  } catch {
    // Some responses arrive fenced despite the JSON mime type.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]) as T;
    throw new Error(`Gemini returned unparseable JSON: ${text.slice(0, 200)}`);
  }
}

/* ------------------------------------------------------- Anthropic */

async function structuredAnthropic<T>(call: StructuredCall): Promise<T> {
  anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: call.tier === "fast" ? ANTHROPIC_FAST : ANTHROPIC_STRONG,
    max_tokens: call.maxTokens ?? 4096,
    system: call.system,
    tools: [
      {
        name: "emit",
        description: "Return the structured result.",
        input_schema: call.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "emit" },
    messages: [{ role: "user", content: call.prompt }],
  });

  const block = response.content.find((c) => c.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Claude returned no structured output");
  }
  return block.input as T;
}

/**
 * One structured call. The model is constrained to the supplied schema
 * so the response is valid JSON rather than prose we have to salvage.
 */
export async function structured<T>(call: StructuredCall): Promise<T> {
  const provider = activeProvider();
  if (!provider) throw new Error("No model API key is configured");

  return provider === "gemini"
    ? structuredGemini<T>(call)
    : structuredAnthropic<T>(call);
}

/**
 * Run `live` when a key is present, fall back to `offline` on any
 * failure. Returns whether the live path actually produced the value,
 * which is what drives the "live / demo corpus" badge in the UI.
 */
export async function withFallback<T>(
  live: () => Promise<T>,
  offline: () => T,
): Promise<{ value: T; live: boolean }> {
  if (!isLive()) return { value: offline(), live: false };
  try {
    return { value: await live(), live: true };
  } catch (err) {
    // Provider errors arrive as multi-line JSON blobs; collapse them so
    // one failed call is one readable log line.
    const reason = (err instanceof Error ? err.message : String(err))
      .replace(/\s+/g, " ")
      .slice(0, 220);
    console.warn(
      `[llm:${activeProvider()}] falling back to the deterministic path: ${reason}`,
    );
    return { value: offline(), live: false };
  }
}
