import { GraphExplorer } from "@/components/graph/GraphExplorer";
import { Eyebrow } from "@/components/ui/kit";
import { Reveal } from "@/components/motion/Reveal";

export const metadata = {
  title: "Knowledge graph",
  description:
    "Scattered product records turned into a graph of brands, categories, attributes, certifications, families and mating parts.",
};

export default function GraphPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-12 pb-6 sm:px-8">
      <Reveal>
        <Eyebrow>Product knowledge graph</Eyebrow>
        <h1 className="text-[clamp(2.1rem,4vw,3.2rem)] font-extrabold tracking-[-0.04em]">
        What connects to what
        </h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-mist-400">
        Attributes answer <em>what is this</em>. Edges answer the questions a
        counter actually gets: what else fits, what replaces this, what else
        carries the same listing. Every relationship here is derived from
        published data — a value still in the review queue is not allowed to
        assert one.
        </p>
      </Reveal>

      <Reveal delay={90} className="mt-8">
        <GraphExplorer />
      </Reveal>
    </div>
  );
}
