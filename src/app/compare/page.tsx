import { ComparePanel } from "@/components/compare/ComparePanel";
import { Eyebrow } from "@/components/ui/kit";
import { Reveal } from "@/components/motion/Reveal";

export const metadata = {
  title: "Compare",
  description:
    "Describe an application in plain words and get a recommendation with a comparison matrix, where unknown is kept distinct from fails.",
};

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-12 pb-6 sm:px-8">
      <Reveal>
        <Eyebrow>Selection copilot</Eyebrow>
        <h1 className="text-[clamp(2.1rem,4vw,3.2rem)] font-extrabold tracking-[-0.04em]">
        Which one should I buy?
        </h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-mist-400">
        Describe the application. The engine parses it into hard and soft
        constraints, scores every candidate on published data only, and says
        why — keeping <span className="text-mist-200">unknown</span> firmly
        apart from <span className="text-mist-200">fails</span>, because a gap
        in the evidence is not a defect in the product.
        </p>
      </Reveal>

      <Reveal delay={90} className="mt-8">
        <ComparePanel />
      </Reveal>
    </div>
  );
}
