import Link from "next/link";
import { EnrichConsole } from "@/components/console/EnrichConsole";
import { Arrow } from "@/components/site/Header";
import { ScrollLink } from "@/components/site/ScrollLink";
import { Badge, StepCard } from "@/components/ui/kit";
import { Reveal } from "@/components/motion/Reveal";

const STEPS = [
  {
    title: "Give it whatever you have",
    body: "A supplier row, a PDF datasheet, a product URL, or a pasted spec block. Nothing needs to be clean first.",
    preview: <PreviewInput />,
  },
  {
    title: "The schema decides what to look for",
    body: "The SKU is classified into its taxonomy, and that class dictates exactly which attributes must exist, in which units, with which legal values.",
    preview: <PreviewSchema />,
  },
  {
    title: "A critic tries to refute every value",
    body: "An adversarial pass checks each claim against its source and against every other source. Contradicted values never reach the record.",
    preview: <PreviewCritic />,
  },
  {
    title: "Only defensible data publishes",
    body: "Confidence is assembled from source authority, corroboration and the critic. Above 92% it publishes; below, a human sees it.",
    preview: <PreviewGate />,
  },
];

export default function HomePage() {
  return (
    <div className="px-3 sm:px-5">
      {/* Hero ----------------------------------------------------------
          Sized to land inside one viewport: the sticky header is about
          6rem, so the band claims the rest and centres itself. Every
          step of the type scale is fluid, which keeps the headline, the
          calls to action and the stat row above the fold on a laptop
          without shrinking them into insignificance on a large screen. */}
      <section className="hero-band relative mt-3 flex min-h-[min(46rem,calc(100dvh-6.5rem))] flex-col justify-center overflow-hidden rounded-[28px] px-6 py-10 sm:px-12">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(70%_70%_at_70%_0%,black,transparent)]" />

        <div className="animate-rise relative mx-auto w-full max-w-[1400px]">
          <p className="strapline text-white/45">
            AI-powered product intelligence
          </p>

          <h1 className="mt-[clamp(0.75rem,1.6vh,1.5rem)] text-[clamp(2.1rem,5.1vw,4.1rem)] leading-[1] font-extrabold tracking-[-0.045em] text-white">
            Scattered specs
            <br />
            into{" "}
            <span className="font-light text-white/55 italic">
              provable product data
            </span>
          </h1>

          <p className="mt-[clamp(1rem,2vh,1.75rem)] max-w-xl text-[clamp(0.95rem,1.15vw,1.05rem)] leading-relaxed text-white/70">
            Extraction is the easy half. This engine fills the attribute schema
            a product&apos;s class demands, then sends an adversarial critic to
            refute every value against its source — so nothing publishes that
            can&apos;t be defended.
          </p>

          <div className="mt-[clamp(1.25rem,2.4vh,2rem)] flex flex-wrap items-center gap-2.5">
            <ScrollLink
              href="#console"
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-[#101013] transition-opacity hover:opacity-90"
            >
              Run an enrichment
              <Arrow />
            </ScrollLink>
            <Link
              href="/search"
              className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              See the commerce impact
            </Link>
            <Link
              href="/graph"
              className="focus-ring inline-flex items-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold text-white/70 transition-colors hover:text-white"
            >
              Knowledge graph
              <Arrow />
            </Link>
          </div>

          <dl className="mt-[clamp(1.5rem,3vh,2.75rem)] flex flex-wrap gap-x-10 gap-y-4 border-t border-white/12 pt-[clamp(1rem,2vh,1.75rem)]">
            <Stat value="Any PDF" label="datasheet, catalog or product URL" />
            <Stat value="Every value" label="cited to a span of its source" />
            <Stat value="92%" label="confidence needed to auto-publish" />
          </dl>
        </div>
      </section>

      {/* How it works -------------------------------------------------- */}
      <section className="mx-auto max-w-[1400px] px-2 pt-20 sm:px-3">
        <Reveal>
          <h2 className="text-[clamp(2rem,3.6vw,3rem)] leading-tight font-extrabold tracking-[-0.035em]">
            How it works
          </h2>
          <p className="mt-3 max-w-xl text-[16px] text-mist-400">
            Eight deterministic stages. Every one leaves a trace you can replay.
          </p>
        </Reveal>

        <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 90} className="lift h-full">
              <StepCard index={i + 1} title={s.title} preview={s.preview}>
                {s.body}
              </StepCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Console ------------------------------------------------------- */}
      <section
        id="console"
        className="mx-auto max-w-[1500px] scroll-mt-24 px-2 pt-20 sm:px-3"
      >
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[clamp(2rem,3.6vw,3rem)] leading-tight font-extrabold tracking-[-0.035em]">
              The console
            </h2>
            <p className="mt-3 max-w-xl text-[16px] text-mist-400">
              Run a SKU and watch the pipeline think. Click any attribute to
              open the exact span of the source it came from.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">attribute-level provenance</Badge>
            <Badge tone="verify">adversarial validation</Badge>
            <Badge tone="amber">confidence gating</Badge>
          </div>
        </Reveal>

        <EnrichConsole />
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dd className="font-mono text-[26px] leading-none font-bold text-white">
        {value}
      </dd>
      <dt className="mt-2 text-[13px] text-white/50">{label}</dt>
    </div>
  );
}

/* ------------------------------------------------------- card previews */

function PreviewInput() {
  return (
    <div className="w-full space-y-2">
      <div className="flex gap-1.5">
        {["PDF", "URL", "Paste"].map((t, i) => (
          <span
            key={t}
            className={
              i === 0
                ? "rounded-full bg-brand-500/15 px-2.5 py-1 font-mono text-[10px] text-brand-600"
                : "rounded-full border border-[var(--hairline)] px-2.5 py-1 font-mono text-[10px] text-mist-500"
            }
          >
            {t}
          </span>
        ))}
      </div>
      <p className="truncate rounded-lg border border-[var(--hairline)] bg-[var(--s-card)] px-2.5 py-2 font-mono text-[11px] text-mist-400">
        BALL VLV 1/2 3PC SS FP LKG
      </p>
    </div>
  );
}

function PreviewSchema() {
  return (
    <ul className="w-full space-y-1.5">
      {[
        ["Body Material", "enum"],
        ["Pressure (WOG)", "psi"],
        ["Nominal Size", "in"],
      ].map(([label, unit]) => (
        <li
          key={label}
          className="flex items-center justify-between rounded-lg border border-[var(--hairline)] bg-[var(--s-card)] px-2.5 py-1.5"
        >
          <span className="text-[11px] text-mist-400">{label}</span>
          <span className="font-mono text-[10px] text-brand-600">{unit}</span>
        </li>
      ))}
    </ul>
  );
}

function PreviewCritic() {
  return (
    <ul className="w-full space-y-1.5">
      {[
        ["2000 psi", true],
        ["1000 psi", false],
        ["600 psi", false],
      ].map(([value, kept]) => (
        <li
          key={String(value)}
          className={
            kept
              ? "flex items-center gap-2 rounded-lg border border-verify-400/30 bg-verify-400/10 px-2.5 py-1.5"
              : "flex items-center gap-2 rounded-lg border border-reject-400/25 bg-reject-400/[0.07] px-2.5 py-1.5"
          }
        >
          <span
            className={
              kept
                ? "font-mono text-[11px] text-verify-400"
                : "font-mono text-[11px] text-reject-400 line-through"
            }
          >
            {value}
          </span>
          <span className="ml-auto font-mono text-[9px] text-mist-500">
            {kept ? "kept" : "refuted"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PreviewGate() {
  return (
    <div className="w-full space-y-2.5">
      {[
        ["Published", 0.91, "bg-verify-400"],
        ["Review", 0.09, "bg-amber-500"],
      ].map(([label, value, bar]) => (
        <div key={String(label)}>
          <div className="mb-1 flex justify-between">
            <span className="text-[11px] text-mist-400">{String(label)}</span>
            <span className="font-mono text-[10px] text-mist-500">
              {Math.round(Number(value) * 100)}%
            </span>
          </div>
          <div className="tint-3 h-1.5 overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${bar}`}
              style={{ width: `${Number(value) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
