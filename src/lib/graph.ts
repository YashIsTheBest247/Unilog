/* ------------------------------------------------------------------ *
 * Product knowledge graph.
 *
 * Attributes on a record answer "what is this?". Edges answer the
 * questions a distributor actually gets asked: what else fits, what
 * replaces this, what else is certified the same way, what else comes
 * off this datasheet.
 *
 * Every edge here is derived from published data. Nothing is inferred
 * from a model's sense of what usually goes together, and nothing is
 * built from a value still sitting in the review queue - an unverified
 * attribute is not allowed to assert a relationship, because a wrong
 * "mates with" edge ends in a flange that will not bolt up.
 * ------------------------------------------------------------------ */

import { getClass } from "@/data/taxonomy";
import { VARIANTS } from "@/data/variants";
import { parseFractional } from "@/lib/units";
import type { CatalogRecord } from "@/lib/catalog";

export type NodeKind =
  | "product"
  | "brand"
  | "class"
  | "attribute"
  | "certification"
  | "standard"
  | "country";

export type EdgeKind =
  | "manufactured_by"
  | "classified_as"
  | "has_value"
  | "certified_to"
  | "built_to"
  | "made_in"
  | "variant_of"
  | "alternative_to"
  | "mates_with";

export const EDGE_LABEL: Record<EdgeKind, string> = {
  manufactured_by: "manufactured by",
  classified_as: "category",
  has_value: "attribute",
  certified_to: "certified to",
  built_to: "built to",
  made_in: "made in",
  variant_of: "variant of",
  alternative_to: "alternative to",
  mates_with: "mates with",
};

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** Attribute nodes carry the attribute they belong to. */
  group?: string;
  degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  /** Why this edge exists, in one clause. */
  note?: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    nodes: number;
    edges: number;
    byKind: Array<{ kind: EdgeKind; count: number }>;
  };
}

/* ------------------------------------------------ certification parsing */

const CERT_PATTERNS: RegExp[] = [
  /\bNSF\/ANSI\s*[\w-]+/gi,
  /\bMSS\s*SP-\d+/gi,
  /\bAPI\s*\d{3}/gi,
  /\bASME\s*B[\d.]+/gi,
  /\bASTM\s*[A-Z]\d+(?:\s+[A-Z]{2}\d*[A-Z]?)?/gi,
  /\b(?:UL|FM|CSA|IAPMO|CRN)\b/g,
];

/** Standards bodies get their own node kind; listings are certifications. */
function isStandard(name: string) {
  return /^(ASME|ASTM|MSS|API)/i.test(name);
}

function tidy(name: string) {
  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

function certificationsFrom(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of CERT_PATTERNS) {
    for (const m of text.matchAll(pattern)) found.add(tidy(m[0]));
  }
  return [...found];
}

/* ------------------------------------------------------------- builder */

export function buildGraph(records: CatalogRecord[]): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  const addNode = (
    id: string,
    kind: NodeKind,
    label: string,
    group?: string,
  ) => {
    if (!nodes.has(id)) nodes.set(id, { id, kind, label, group, degree: 0 });
    return id;
  };

  const addEdge = (
    source: string,
    target: string,
    kind: EdgeKind,
    note?: string,
  ) => {
    edges.push({ source, target, kind, note });
    const s = nodes.get(source);
    const t = nodes.get(target);
    if (s) s.degree++;
    if (t) t.degree++;
  };

  /* -------------------------------------------- products and their facts */
  for (const record of records) {
    const productId = `product:${record.id}`;
    addNode(productId, "product", `${record.raw.brand} ${record.raw.mpn}`);

    const brandId = addNode(
      `brand:${record.raw.brand.toLowerCase()}`,
      "brand",
      record.raw.brand,
    );
    addEdge(productId, brandId, "manufactured_by");

    const classId = addNode(
      `class:${record.classId}`,
      "class",
      record.className,
    );
    addEdge(productId, classId, "classified_as");

    for (const attribute of record.attributes) {
      // Only published values may assert a relationship.
      if (attribute.decision !== "publish" || attribute.value === null) continue;

      if (attribute.key === "country_of_origin") {
        const id = addNode(
          `country:${attribute.value.toLowerCase()}`,
          "country",
          attribute.value,
        );
        addEdge(productId, id, "made_in");
        continue;
      }

      if (
        attribute.key === "approvals" ||
        attribute.key === "astm_spec" ||
        attribute.key === "standard"
      ) {
        for (const name of certificationsFrom(attribute.value)) {
          const standard = isStandard(name);
          const id = addNode(
            `${standard ? "standard" : "certification"}:${name.toLowerCase()}`,
            standard ? "standard" : "certification",
            name,
          );
          addEdge(productId, id, standard ? "built_to" : "certified_to");
        }
        continue;
      }

      // Facetable attributes are the ones buyers navigate by, so they
      // are the ones worth making into shared nodes.
      if (!attribute.facetable) continue;

      const id = addNode(
        `attribute:${attribute.key}:${attribute.value.toLowerCase()}`,
        "attribute",
        attribute.value,
        attribute.label,
      );
      addEdge(productId, id, "has_value", attribute.label);
    }
  }

  /* ---------------------------------------------------- family variants */
  const byMpn = new Map(records.map((r) => [r.raw.mpn, r]));
  for (const spec of VARIANTS) {
    const parent = records.find((r) => r.id === spec.parentId);
    if (!parent) continue;
    for (const row of spec.rows) {
      const child = byMpn.get(row.mpn);
      if (!child) continue;
      addEdge(
        `product:${child.id}`,
        `product:${parent.id}`,
        "variant_of",
        `Same datasheet, row ${row.mpn}`,
      );
    }
  }

  /* ------------------------------------------------------- alternatives */
  const published = (r: CatalogRecord, key: string) => {
    const a = r.attributes.find((x) => x.key === key);
    return a && a.decision === "publish" ? a.value : null;
  };

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      if (a.classId !== b.classId) continue;

      const size = published(a, "nominal_size");
      if (!size || size !== published(b, "nominal_size")) continue;

      // Same class, same size, same way of joining the pipe. That is a
      // real shortlist; it is not a claim that they are equivalent, so
      // the edge carries what differs.
      const connectionKey =
        a.classId === "PVF-FIT-NIPPLE" ? "thread_configuration" : "end_connection";
      const connection = published(a, connectionKey);
      if (!connection || connection !== published(b, connectionKey)) continue;

      const cls = getClass(a.classId);
      const differences = cls.attributes
        .filter((spec) => spec.facetable && spec.key !== "nominal_size")
        .map((spec) => {
          const av = published(a, spec.key);
          const bv = published(b, spec.key);
          return av && bv && av !== bv ? `${spec.label} ${av} vs ${bv}` : null;
        })
        .filter(Boolean) as string[];

      addEdge(
        `product:${a.id}`,
        `product:${b.id}`,
        "alternative_to",
        differences.length > 0
          ? `Differs on ${differences.slice(0, 2).join("; ")}`
          : "Same published specification",
      );
    }
  }

  /* -------------------------------------------------------- mating parts */
  // A valve that names a flange drilling standard mates with a flange
  // of that class in the same nominal size. This is the one edge that
  // crosses product families, and it is the one a counter clerk is
  // actually asked for.
  const flanges = records.filter((r) => r.classId === "PVF-FLG-PIPE");

  for (const valve of records) {
    if (valve.classId === "PVF-FLG-PIPE") continue;

    const standard = published(valve, "flange_standard");
    if (!standard) continue;

    const valveSize = published(valve, "nominal_size");
    if (!valveSize) continue;

    for (const flange of flanges) {
      const flangeClass = published(flange, "pressure_class");
      const flangeSize = published(flange, "nominal_size");
      if (!flangeClass || !flangeSize) continue;

      const sameSize =
        parseFractional(valveSize) !== null &&
        parseFractional(valveSize) === parseFractional(flangeSize);
      if (!sameSize) continue;

      // "ASME B16.5 Class 150" has to actually name this flange's class.
      if (!standard.toLowerCase().includes(flangeClass.toLowerCase())) continue;

      addEdge(
        `product:${valve.id}`,
        `product:${flange.id}`,
        "mates_with",
        `${valveSize}" ${flangeClass}, per "${standard}"`,
      );
    }
  }

  const byKind = new Map<EdgeKind, number>();
  for (const e of edges) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1);

  return {
    nodes: [...nodes.values()],
    edges,
    stats: {
      nodes: nodes.size,
      edges: edges.length,
      byKind: [...byKind.entries()]
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

/* --------------------------------------------------------- ego network */

export interface Neighbour {
  node: GraphNode;
  kind: EdgeKind;
  note?: string;
  /** True when the edge points away from the focused node. */
  outbound: boolean;
}

/** Everything one hop from a node, grouped for a radial layout. */
export function egoNetwork(
  graph: KnowledgeGraph,
  focusId: string,
): { focus: GraphNode | null; neighbours: Neighbour[] } {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const focus = byId.get(focusId) ?? null;
  if (!focus) return { focus: null, neighbours: [] };

  const neighbours: Neighbour[] = [];

  for (const edge of graph.edges) {
    if (edge.source === focusId) {
      const node = byId.get(edge.target);
      if (node) neighbours.push({ node, kind: edge.kind, note: edge.note, outbound: true });
    } else if (edge.target === focusId) {
      const node = byId.get(edge.source);
      if (node) neighbours.push({ node, kind: edge.kind, note: edge.note, outbound: false });
    }
  }

  const order: EdgeKind[] = [
    "classified_as",
    "manufactured_by",
    "has_value",
    "certified_to",
    "built_to",
    "made_in",
    "variant_of",
    "alternative_to",
    "mates_with",
  ];

  return {
    focus,
    neighbours: neighbours.sort(
      (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
    ),
  };
}
