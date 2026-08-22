import { Panel, Eyebrow } from "@/components/ui/kit";

export default function BatchPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 pt-14 sm:px-8">
      <Eyebrow>Batch operations</Eyebrow>
      <h1 className="text-4xl font-extrabold tracking-[-0.03em]">
        Catalog run
      </h1>
      <p className="mt-3 max-w-xl text-mist-400">
        Throughput, auto-publish rate, and the human review queue for a full
        catalog batch.
      </p>
      <Panel className="mt-8 grid place-items-center px-6 py-24 text-mist-500">
        Wired up in a later phase.
      </Panel>
    </div>
  );
}
