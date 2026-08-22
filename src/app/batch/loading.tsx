import { Eyebrow, Panel } from "@/components/ui/kit";

export default function BatchLoading() {
  return (
    <div className="mx-auto max-w-[1500px] px-5 pt-14 sm:px-8">
      <Eyebrow>Batch operations</Eyebrow>
      <h1 className="text-[clamp(2rem,3.6vw,2.9rem)] font-extrabold tracking-[-0.03em]">
        Catalog run
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] text-mist-400">
        Pushing every SKU on the bench through all eight stages.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {[0, 1].map((i) => (
          <Panel key={i} className="h-64 overflow-hidden">
            <div className="h-full w-full bg-[linear-gradient(100deg,transparent_20%,color-mix(in_srgb,var(--color-brand-500)_9%,transparent)_50%,transparent_80%)] bg-[length:200%_100%] animate-shimmer" />
          </Panel>
        ))}
      </div>
    </div>
  );
}
