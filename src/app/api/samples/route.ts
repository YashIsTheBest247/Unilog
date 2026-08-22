import { CORPUS } from "@/data/corpus";
import { SOURCE_LABEL } from "@/lib/types";

export const runtime = "nodejs";

/**
 * The demo bench: the supplier rows the bundled corpus can answer for,
 * exactly as ugly as they arrive from a real vendor feed.
 */
export async function GET() {
  return Response.json({
    samples: CORPUS.map((entry) => ({
      ...entry.raw,
      expectedClass: entry.expectedClass,
      sourceCount: entry.sources.length,
      sourceKinds: [...new Set(entry.sources.map((s) => SOURCE_LABEL[s.kind]))],
    })),
  });
}
