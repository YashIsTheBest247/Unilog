import { runCatalog } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The bundled sample catalogue. Nothing loads this automatically - the
 * user asks for it, and every record comes back flagged as a sample.
 */
export async function GET() {
  try {
    const result = await runCatalog();
    return Response.json({ ...result, sample: true });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "The sample catalogue could not be built.",
      },
      { status: 500 },
    );
  }
}
