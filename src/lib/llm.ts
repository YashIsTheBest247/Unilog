/* ------------------------------------------------------------------ *
 * Model access.
 *
 * Two rules govern this file.
 *
 * 1. The engine must run without a key. Every call site has a
 *    deterministic fallback over the bundled corpus, so the app deploys,
 *    demos and scores identically with an empty environment.
 * 2. A model failure is never fatal. Anything thrown here is caught by
 *    the caller and downgraded to the deterministic path, with the run
 *    marked `live: false` so the UI can say so honestly.
 *
 * Model tiering is deliberate: classification and normalization are
 * cheap, high-volume decisions and go to the fast model; extraction and
 * critique are the judgement calls and go to the strong one. At two
 * million SKUs that difference is the whole operating cost.
 * ------------------------------------------------------------------ */

import Anthropic from "@anthropic-ai/sdk";

const STRONG_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const FAST_MODEL =
  process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;

export function isLive(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface StructuredCall {
  /** Which tier to bill this call to. */
  tier: "fast" | "strong";
  system: string;
  prompt: string;
  /** JSON Schema the model is forced to emit. */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

/**
 * One structured call. The model is forced through a single tool so the
 * response is schema-valid JSON rather than prose we have to salvage.
 */
export async function structured<T>(call: StructuredCall): Promise<T> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: call.tier === "fast" ? FAST_MODEL : STRONG_MODEL,
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
    throw new Error("Model returned no structured output");
  }
  return block.input as T;
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
    console.warn(
      `[llm] falling back to the deterministic path: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { value: offline(), live: false };
  }
}
