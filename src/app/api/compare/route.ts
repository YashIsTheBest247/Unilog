import { NextRequest } from "next/server";
import { z } from "zod";
import { getClass, TAXONOMY } from "@/data/taxonomy";
import { runCatalog } from "@/lib/catalog";
import { requirementsFromQuery, runComparison } from "@/lib/pipeline/compare";
import type { Requirement } from "@/lib/pipeline/compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequirementSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  op: z.enum(["eq", "gte", "lte", "oneOf"]),
  value: z.string().trim().min(1),
  weight: z.enum(["must", "should"]),
});

const Body = z.object({
  classId: z.string().trim().min(1),
  /** Limit the field; empty means every SKU in the class. */
  skus: z.array(z.string()).max(24).default([]),
  requirements: z.array(RequirementSchema).max(12).default([]),
  /** Plain-language spec, parsed into requirements when supplied. */
  query: z.string().trim().max(400).default(""),
});

export async function GET() {
  const { records } = await runCatalog();

  // Only classes with something to compare are worth offering.
  const classes = TAXONOMY.map((cls) => {
    const inClass = records.filter((r) => r.classId === cls.id);
    return {
      id: cls.id,
      label: cls.label,
      count: inClass.length,
      skus: inClass.map((r) => ({
        id: r.id,
        mpn: r.raw.mpn,
        brand: r.raw.brand,
        title: r.commerce.title,
        quality: r.after.total,
      })),
      attributes: cls.attributes
        .filter((a) => a.facetable || a.required)
        .map((a) => ({
          key: a.key,
          label: a.label,
          type: a.type,
          unit: a.unit,
          values: a.values ?? [],
          required: a.required,
        })),
    };
  }).filter((c) => c.count > 1);

  return Response.json({ classes });
}

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

  let cls;
  try {
    cls = getClass(parsed.classId);
  } catch {
    return Response.json({ error: "Unknown product class." }, { status: 400 });
  }

  const { records } = await runCatalog();
  const inClass = records.filter((r) => r.classId === parsed.classId);
  const field =
    parsed.skus.length > 0
      ? inClass.filter((r) => parsed.skus.includes(r.id))
      : inClass;

  if (field.length === 0) {
    return Response.json(
      { error: "No candidates in that class." },
      { status: 400 },
    );
  }

  const parsedFromQuery: Requirement[] = parsed.query
    ? requirementsFromQuery(cls, parsed.query)
    : [];

  // Explicit requirements win over anything inferred from the sentence.
  const byKey = new Map<string, Requirement>();
  for (const r of parsedFromQuery) byKey.set(r.key, r);
  for (const r of parsed.requirements) byKey.set(r.key, r);
  const requirements = [...byKey.values()];

  if (requirements.length === 0) {
    return Response.json(
      {
        error:
          "No requirements to compare against. Describe the application or add a constraint.",
      },
      { status: 400 },
    );
  }

  return Response.json({
    comparison: runComparison(field, requirements),
    derived: parsedFromQuery,
  });
}
