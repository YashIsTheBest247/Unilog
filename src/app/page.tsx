import Link from "next/link";
import { EnrichConsole } from "@/components/console/EnrichConsole";
import { Badge, Button, Eyebrow } from "@/components/ui/kit";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1500px] px-5 sm:px-8">
      {/* Hero ---------------------------------------------------------- */}
      <section className="relative overflow-hidden pt-14 pb-12 sm:pt-20">
        <div className="grid-lines pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />

        <div className="max-w-3xl animate-rise">
          <Eyebrow>Taxonomy-driven enrichment engine</Eyebrow>
          <h1 className="text-[clamp(2.2rem,4.8vw,3.6rem)] leading-[1.03] font-extrabold tracking-[-0.035em]">
            <span className="text-gradient">Limited product data in.</span>
            <br />
            Defensible product intelligence out.
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-mist-300">
            Extraction is the easy half. This engine classifies a SKU into its
            taxonomy, fills the attribute schema that class demands, then sends
            an adversarial critic to refute every value against its source — so
            nothing gets published that can&apos;t be defended.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            <Badge tone="brand">attribute-level provenance</Badge>
            <Badge tone="verify">adversarial validation</Badge>
            <Badge tone="amber">confidence-gated publishing</Badge>
            <Link href="/search" className="ml-1">
              <Button size="sm" variant="outline">
                See the commerce impact
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section id="console" className="pb-12">
        <EnrichConsole />
      </section>
    </div>
  );
}
