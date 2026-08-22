"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EdgeKind,
  GraphNode,
  KnowledgeGraph,
  NodeKind,
} from "@/lib/graph";
import { EDGE_LABEL, egoNetwork } from "@/lib/graph";
import { Badge, Panel, PanelHeader } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

const KIND_STYLE: Record<NodeKind, { fill: string; text: string; label: string }> = {
  product: { fill: "var(--a-base)", text: "var(--on-accent)", label: "Product" },
  brand: { fill: "var(--t2)", text: "var(--s-card)", label: "Brand" },
  class: { fill: "var(--sig-verify)", text: "var(--s-card)", label: "Category" },
  attribute: { fill: "var(--s-raised)", text: "var(--t2)", label: "Attribute" },
  certification: {
    fill: "var(--sig-amber)",
    text: "var(--s-card)",
    label: "Certification",
  },
  standard: { fill: "var(--s-hover)", text: "var(--t2)", label: "Standard" },
  country: { fill: "var(--s-hover)", text: "var(--t2)", label: "Origin" },
};

const EDGE_STYLE: Partial<Record<EdgeKind, string>> = {
  mates_with: "var(--sig-amber)",
  variant_of: "var(--a-base)",
  alternative_to: "var(--sig-verify)",
};

function truncate(text: string, max = 22) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function GraphExplorer() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [focusId, setFocusId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/graph")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) return setError(json.error);
        setGraph(json.graph);
        const firstProduct = json.graph.nodes.find(
          (n: GraphNode) => n.kind === "product",
        );
        if (firstProduct) setFocusId(firstProduct.id);
      })
      .catch(() => setError("The knowledge graph could not be loaded."));
    return () => {
      cancelled = true;
    };
  }, []);

  const ego = useMemo(
    () => (graph ? egoNetwork(graph, focusId) : { focus: null, neighbours: [] }),
    [graph, focusId],
  );

  const products = useMemo(() => {
    if (!graph) return [];
    const q = filter.trim().toLowerCase();
    return graph.nodes
      .filter((n) => n.kind === "product")
      .filter((n) => !q || n.label.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [graph, filter]);

  const grouped = useMemo(() => {
    const map = new Map<EdgeKind, typeof ego.neighbours>();
    for (const n of ego.neighbours) {
      const list = map.get(n.kind);
      if (list) list.push(n);
      else map.set(n.kind, [n]);
    }
    return [...map.entries()];
  }, [ego.neighbours]);

  if (error) {
    return (
      <Panel className="grid place-items-center px-6 py-20 text-center">
        <p className="text-sm text-mist-300">{error}</p>
      </Panel>
    );
  }

  if (!graph) {
    return (
      <Panel className="grid place-items-center px-6 py-24">
        <p className="strapline animate-pulse text-[10px] text-brand-500">
          building the graph…
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats --------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel className="px-5 py-4">
          <p className="strapline text-[10px] text-mist-500">Entities</p>
          <p className="mt-1 font-mono text-3xl font-bold text-mist-100">
            {graph.stats.nodes}
          </p>
        </Panel>
        <Panel className="px-5 py-4">
          <p className="strapline text-[10px] text-mist-500">Relationships</p>
          <p className="mt-1 font-mono text-3xl font-bold text-brand-500">
            {graph.stats.edges}
          </p>
        </Panel>
        <Panel className="px-5 py-4">
          <p className="strapline mb-2 text-[10px] text-mist-500">By type</p>
          <div className="flex flex-wrap gap-1">
            {graph.stats.byKind.slice(0, 5).map((k) => (
              <span
                key={k.kind}
                className="rounded-full border border-[var(--hairline)] px-2 py-0.5 font-mono text-[10px] text-mist-400"
              >
                {EDGE_LABEL[k.kind]} {k.count}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        {/* Picker ------------------------------------------------------ */}
        <Panel className="h-fit overflow-hidden lg:sticky lg:top-24">
          <PanelHeader title="Products" hint="Pick a node to explore" />
          <div className="px-4 pt-3">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              className="focus-ring field w-full rounded-lg px-3 py-2 text-[13px] text-mist-100 placeholder:text-mist-600 focus:border-brand-500"
            />
          </div>
          <ul className="mt-2 max-h-[26rem] divide-y divide-[var(--hairline)] overflow-y-auto">
            {products.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setFocusId(p.id)}
                  className={cn(
                    "focus-ring w-full px-4 py-2.5 text-left transition-colors",
                    focusId === p.id ? "bg-brand-500/[0.09]" : "tint-hover",
                  )}
                >
                  <span
                    className={cn(
                      "block truncate font-mono text-[12px]",
                      focusId === p.id ? "text-brand-600" : "text-mist-200",
                    )}
                  >
                    {p.label}
                  </span>
                  <span className="text-[11px] text-mist-500">
                    {p.degree} relationships
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Canvas ------------------------------------------------------ */}
        <div className="space-y-5">
          <Panel className="overflow-hidden">
            <PanelHeader
              title={ego.focus?.label ?? "—"}
              hint={
                ego.focus
                  ? `${KIND_STYLE[ego.focus.kind].label} · ${ego.neighbours.length} relationships`
                  : undefined
              }
              right={
                <div className="flex flex-wrap gap-1.5">
                  {(
                    ["product", "attribute", "certification", "class"] as NodeKind[]
                  ).map((k) => (
                    <span
                      key={k}
                      className="flex items-center gap-1.5 text-[11px] text-mist-500"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ background: KIND_STYLE[k].fill }}
                      />
                      {KIND_STYLE[k].label}
                    </span>
                  ))}
                </div>
              }
            />

            <div className="overflow-x-auto">
              <svg
                viewBox="0 0 760 600"
                className="h-auto w-full min-w-[42rem]"
                role="img"
                aria-label={`Relationship map for ${ego.focus?.label ?? "the selected node"}`}
              >
                {(() => {
                  const cx = 380;
                  const cy = 300;
                  const total = Math.max(1, ego.neighbours.length);

                  return (
                    <>
                      {ego.neighbours.map((n, i) => {
                        // Alternate radii so adjacent labels cannot collide
                        // on a dense node.
                        const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
                        const radius = i % 2 === 0 ? 175 : 240;
                        const x = cx + Math.cos(angle) * radius;
                        const y = cy + Math.sin(angle) * radius;
                        const style = KIND_STYLE[n.node.kind];
                        const stroke = EDGE_STYLE[n.kind] ?? "var(--t7)";
                        const width = Math.min(
                          150,
                          Math.max(70, truncate(n.node.label).length * 7.2),
                        );

                        return (
                          <g key={`${n.node.id}-${n.kind}-${i}`}>
                            <line
                              x1={cx}
                              y1={cy}
                              x2={x}
                              y2={y}
                              stroke={stroke}
                              strokeWidth={
                                EDGE_STYLE[n.kind] ? 1.8 : 1
                              }
                              strokeDasharray={
                                n.kind === "alternative_to" ? "4 4" : undefined
                              }
                              opacity={EDGE_STYLE[n.kind] ? 0.8 : 0.45}
                            />

                            <g
                              transform={`translate(${x - width / 2}, ${y - 15})`}
                              className={
                                n.node.kind === "product"
                                  ? "cursor-pointer"
                                  : "cursor-pointer"
                              }
                              onClick={() => setFocusId(n.node.id)}
                            >
                              <rect
                                width={width}
                                height={30}
                                rx={15}
                                fill={style.fill}
                                stroke="var(--hairline-strong)"
                              />
                              <text
                                x={width / 2}
                                y={19}
                                textAnchor="middle"
                                fontSize="11.5"
                                fontWeight="600"
                                fill={style.text}
                              >
                                {truncate(n.node.label, 18)}
                              </text>
                            </g>

                            <text
                              x={cx + Math.cos(angle) * (radius * 0.52)}
                              y={cy + Math.sin(angle) * (radius * 0.52)}
                              textAnchor="middle"
                              fontSize="9.5"
                              fill="var(--t5)"
                              className="font-mono"
                            >
                              {n.kind === "has_value"
                                ? (n.note ?? "attribute").toLowerCase()
                                : EDGE_LABEL[n.kind]}
                            </text>
                          </g>
                        );
                      })}

                      {/* Focus node last so it sits above every edge. */}
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={72}
                          fill="var(--s-card)"
                          stroke="var(--a-base)"
                          strokeWidth={2}
                        />
                        <text
                          x={cx}
                          y={cy - 6}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="700"
                          fill="var(--t1)"
                        >
                          {truncate(ego.focus?.label.split(" ")[0] ?? "", 14)}
                        </text>
                        <text
                          x={cx}
                          y={cy + 11}
                          textAnchor="middle"
                          fontSize="10.5"
                          fill="var(--t4)"
                          className="font-mono"
                        >
                          {truncate(
                            ego.focus?.label.split(" ").slice(1).join(" ") ?? "",
                            16,
                          )}
                        </text>
                      </g>
                    </>
                  );
                })()}
              </svg>
            </div>
          </Panel>

          {/* Relationship list --------------------------------------- */}
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Relationships"
              hint="Every edge derived from published data — nothing inferred"
              right={<Badge tone="neutral">{ego.neighbours.length}</Badge>}
            />
            <div className="divide-y divide-[var(--hairline)]">
              {grouped.map(([kind, list]) => (
                <div key={kind} className="px-5 py-3.5">
                  <p className="strapline mb-2 text-[10px] text-mist-500">
                    {EDGE_LABEL[kind]}
                    <span className="ml-2 font-mono normal-case">
                      {list.length}
                    </span>
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {list.map((n, i) => (
                      <li key={`${n.node.id}-${i}`}>
                        <button
                          type="button"
                          onClick={() => setFocusId(n.node.id)}
                          title={n.note}
                          className={cn(
                            "focus-ring rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                            n.node.kind === "product"
                              ? "border-brand-500/35 bg-brand-500/10 text-brand-600 hover:bg-brand-500/20"
                              : "border-[var(--hairline)] text-mist-300 tint-hover",
                          )}
                        >
                          {n.node.group && (
                            <span className="mr-1.5 text-mist-500">
                              {n.node.group}:
                            </span>
                          )}
                          {n.node.label}
                          {n.node.degree > 1 && (
                            <span className="ml-1.5 font-mono text-[10px] text-mist-500">
                              {n.node.degree}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {list.some((n) => n.note && n.kind !== "has_value") && (
                    <ul className="mt-2 space-y-0.5">
                      {list
                        .filter((n) => n.note && n.kind !== "has_value")
                        .map((n, i) => (
                          <li
                            key={i}
                            className="text-[12px] leading-relaxed text-mist-500"
                          >
                            <span className="text-mist-300">
                              {n.node.label}
                            </span>{" "}
                            — {n.note}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
