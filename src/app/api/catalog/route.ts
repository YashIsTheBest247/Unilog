import { runCatalog } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runCatalog();
    return Response.json(result);
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "The catalog run could not complete.",
      },
      { status: 500 },
    );
  }
}
