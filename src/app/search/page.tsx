import { SearchExplorer } from "@/components/search/SearchExplorer";
import { Eyebrow } from "@/components/ui/kit";

export const metadata = {
  title: "Search impact",
  description:
    "The same storefront query against raw supplier data and against enriched records, with the facet rail that appears in between.",
};

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-12 pb-6 sm:px-8">
      <Eyebrow>Commerce impact</Eyebrow>
      <h1 className="text-[clamp(2.1rem,4vw,3.2rem)] font-extrabold tracking-[-0.04em]">
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
