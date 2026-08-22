import { SearchExplorer } from "@/components/search/SearchExplorer";
import { Eyebrow } from "@/components/ui/kit";

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-5 pt-14 pb-6 sm:px-8">
      <Eyebrow>Commerce impact</Eyebrow>
      <h1 className="text-[clamp(2rem,3.6vw,2.9rem)] font-extrabold tracking-[-0.03em]">
        The same storefront, twice
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-mist-400">
        Enrichment that does not change what a buyer can find is an expensive
        filing exercise. Run a real query against the raw supplier feed, then
        against the published records, and watch the facet rail appear.
      </p>

      <div className="mt-8">
        <SearchExplorer />
      </div>
    </div>
  );
}
