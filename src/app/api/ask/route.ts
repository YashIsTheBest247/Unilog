import { NextRequest } from "next/server";
import { z } from "zod";
import { findCorpusEntry } from "@/data/corpus";
import { ask } from "@/lib/pipeline/ask";
import type { EvidenceSource, SourceKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  question: z.string().trim().min(3, "Ask a question").max(400),
  mpn: z.string().trim().max(80).default(""),
  brand: z.string().trim().max(80).default(""),
  sources: z
    .array(
      z.object({
        kind: z.enum([
          "manufacturer_datasheet",
          "manufacturer_web",
          "catalog_pdf",
          "distributor_listing",
          "marketplace",
          "product_image",
        ]),
        title: z.string().trim().min(1).max(200),
        locator: z.string().trim().max(200).default(""),
        url: z.string().trim().max(2000).default(""),
        text: z.string().min(1).max(80_000),
      }),
    )
    .max(8)
    .default([]),
});

export async function POST(request: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues
            .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
            .join("; ")
        : "Request body could not be parsed";
    return Response.json({ error: message }, { status: 400 });
  }

  // Cached evidence for the SKU, plus anything the operator attached.
  const cached = parsed.mpn
    ? (findCorpusEntry(parsed.mpn, parsed.brand)?.sources ?? [])
    : [];

  const supplied: EvidenceSource[] = parsed.sources.map((s, i) => ({
    id: `user-${i}`,
    kind: s.kind as SourceKind,
    title: s.title,
    locator: s.locator,
    url: s.url,
    retrievedAt: "",
    excerpt: s.text,
    claims: [],
  }));

  const pool = [...cached, ...supplied];

  try {
    const answer = await ask(pool, parsed.question);
    return Response.json({
      answer,
      sources: pool.map((s) => ({
        id: s.id,
        kind: s.kind,
        title: s.title,
        locator: s.locator,
        url: s.url,
        excerpt: s.excerpt,
      })),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "The question could not be answered." },
      { status: 500 },
    );
  }
}
