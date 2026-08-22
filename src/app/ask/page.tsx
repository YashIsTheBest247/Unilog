import { AskPanel } from "@/components/ask/AskPanel";
import { Eyebrow } from "@/components/ui/kit";
import { Reveal } from "@/components/motion/Reveal";

export const metadata = {
  title: "Ask the datasheet",
  description:
    "Grounded question answering over a product's evidence pool, with cited spans and an honest not-found.",
};

export default function AskPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-12 pb-6 sm:px-8">
      <Reveal>
        <Eyebrow>Grounded question answering</Eyebrow>
        <h1 className="text-[clamp(2.1rem,4vw,3.2rem)] font-extrabold tracking-[-0.04em]">
        Ask the datasheet
        </h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-mist-400">
        Answers come only from the attached documents, with the exact span that
        carries them. When the documents don&apos;t say, it says so — a
        confident answer about a valve that can&apos;t take the temperature is
        worse than no answer, because someone will specify on it.
        </p>
      </Reveal>

      <Reveal delay={90} className="mt-8">
        <AskPanel />
      </Reveal>
    </div>
  );
}
