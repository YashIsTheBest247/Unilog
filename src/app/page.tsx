import Link from "next/link";
import { Badge, Button, Eyebrow, Panel, PanelHeader } from "@/components/ui/kit";

const STAGES = [
  { id: "classify", label: "Classify", note: "taxonomy + attribute schema" },
  { id: "retrieve", label: "Retrieve", note: "authority-ranked evidence" },
  { id: "extract", label: "Extract", note: "schema-constrained, cited" },
  { id: "normalize", label: "Normalize", note: "units, enums, ranges" },
  { id: "critique", label: "Critique", note: "adversarial refutation" },
  { id: "resolve", label: "Resolve", note: "conflicts + confidence" },
  { id: "gate", label: "Gate", note: "publish / review / reject" },
  { id: "compose", label: "Compose", note: "SEO, synonyms, facets" },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
      {/* Hero ---------------------------------------------------------- */}
      <section className="relative overflow-hidden pt-16 pb-14 sm:pt-24">
        <div className="grid-lines pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />

        <div className="max-w-3xl animate-rise">
          <Eyebrow>Taxonomy-driven enrichment engine</Eyebrow>
          <h1 className="text-[clamp(2.4rem,5.4vw,4.1rem)] leading-[1.02] font-extrabold tracking-[-0.035em]">
            <span className="text-gradient">Limited product data in.</span>
            <br />
            Defensible product intelligence out.
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-mist-300">
            Extraction is the easy half. This engine classifies a SKU into its
            taxonomy, fills the attribute schema that class demands, then sends
            an adversarial critic to refute every value against its source —
            so nothing gets published that can&apos;t be defended.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/#console">
              <Button size="lg">Run an enrichment</Button>
            </Link>
            <Link href="/search">
              <Button size="lg" variant="outline">
                See the commerce impact
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <Badge tone="brand">attribute-level provenance</Badge>
            <Badge tone="verify">adversarial validation</Badge>
            <Badge tone="amber">confidence-gated publishing</Badge>
          </div>
        </div>
      </section>

      {/* Pipeline strip ------------------------------------------------ */}
      <section className="pb-16">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Pipeline"
            hint="Eight deterministic stages — each one leaves an auditable trace"
            right={<Badge tone="neutral">v0.1</Badge>}
          />
          <ol className="grid grid-cols-2 divide-x divide-y divide-[var(--hairline)] sm:grid-cols-4">
            {STAGES.map((s, i) => (
              <li key={s.id} className="group relative p-5">
                <span className="font-mono text-[11px] text-brand-500/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-1.5 text-[15px] font-bold text-mist-100">
                  {s.label}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-mist-500">
                  {s.note}
                </p>
                <span className="absolute inset-x-0 bottom-0 h-px scale-x-0 bg-brand-500 transition-transform duration-300 group-hover:scale-x-100" />
              </li>
            ))}
          </ol>
        </Panel>
      </section>

      {/* Console anchor (filled in a later phase) ----------------------- */}
      <section id="console" className="pb-10">
        <Panel className="grid place-items-center px-6 py-20 text-center">
          <p className="font-mono text-[11px] tracking-[0.22em] text-brand-400 uppercase">
            console
          </p>
          <p className="mt-3 max-w-md text-mist-400">
            The enrichment console mounts here once the pipeline is wired in.
          </p>
        </Panel>
      </section>
    </div>
  );
}
