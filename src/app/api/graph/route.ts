import { runCatalog } from "@/lib/catalog";
import { buildGraph } from "@/lib/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { records } = await runCatalog();
    return Response.json({ graph: buildGraph(records) });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "The graph could not be built.",
      },
      { status: 500 },
    );
  }
}
