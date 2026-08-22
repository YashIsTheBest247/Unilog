import { NextRequest } from "next/server";
import { z } from "zod";
import { runPipeline } from "@/lib/pipeline/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  mpn: z.string().trim().min(1, "An MPN is required").max(80),
  brand: z.string().trim().min(1, "A brand is required").max(80),
  description: z.string().trim().max(400).default(""),
  supplierCategory: z.string().trim().max(120).optional(),
  listPrice: z.number().nonnegative().optional(),
  uom: z.string().trim().max(12).optional(),
});

/**
 * Streams the enrichment trace as server-sent events. The pipeline is a
 * generator, so each stage reaches the browser the moment it lands
 * instead of the whole run arriving at once behind a spinner.
 */
export async function POST(request: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues.map((i) => i.message).join("; ")
        : "Request body could not be parsed";
    return Response.json({ error: message }, { status: 400 });
  }

  const raw = {
    id: `sku-${parsed.brand}-${parsed.mpn}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    ...parsed,
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        for await (const event of runPipeline(raw)) {
          send(event);
        }
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.enqueue(encoder.encode("event: end\ndata: {}\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Proxies that buffer will hold the whole stream until the run ends.
      "X-Accel-Buffering": "no",
    },
  });
}
