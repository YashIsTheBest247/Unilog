import { BatchDashboard } from "@/components/batch/BatchDashboard";
import { Eyebrow } from "@/components/ui/kit";

export const metadata = {
  title: "Workspace",
  description:
    "Auto-publish rate, human review queue and quality distribution across everything you have enriched.",
};

export default function BatchPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-12 pb-6 sm:px-8">
      <Eyebrow>Batch operations</Eyebrow>
      <h1 className="text-[clamp(2.1rem,4vw,3.2rem)] font-extrabold tracking-[-0.04em]">
        Your workspace
      </h1>
      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-mist-400">
        Everything you have put through the engine. The number that matters is
        not how many attributes were produced — it is how many carried enough
        evidence to publish without a human reading them.
      </p>

      <div className="mt-8">
        <BatchDashboard />
      </div>
    </div>
  );
}
