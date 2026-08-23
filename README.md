# Unify

**Product intelligence for industrial commerce.** Give it a one-line supplier
row, a PDF datasheet or a product URL, and it returns a commerce-ready record
in which every attribute cites the exact span of the source it came from.

**Live:** https://get-unify.vercel.app

---

## Features

### Enrichment

- **Taxonomy-driven schema filling.** A SKU is classified into its product
  class, and that class dictates which attributes must exist, in which units,
  with which legal values — so extraction is "fill this schema", not "find what
  you can", and completeness becomes measurable.
- **Multi-format ingest.** PDF datasheets (text layer), fetched product URLs,
  pasted specification blocks, and plain text or CSV uploads.
- **Unit and vocabulary normalisation.** Fractional inches, DN → NPS, bar → psi,
  °C → °F, and trade shorthand (`CF8M` → Stainless Steel 316, `blk` → Black
  Steel, `3pc` → 3-Piece). Ambiguous values are declined rather than guessed.
- **Variant explosion.** A dimension table naming several part numbers becomes a
  fully attributed record per row, each citing its own row.

### Validation

- **Attribute-level provenance.** Every value carries its source, the exact
  character offsets of the sentence that states it, the derivation method, a
  confidence score and a critic verdict.
- **Source authority ranking.** Manufacturer datasheet `1.00` > manufacturer web
  `0.92` > catalog `0.84` > distributor `0.66` > marketplace `0.45`.
- **Adversarial critic.** A separate pass prompted to *refute* each claim rather
  than confirm it, returning `SUPPORTED`, `UNSUPPORTED` or `CONTRADICTED`.
- **Conflict resolution kept on the record.** When sources disagree, both values
  are retained along with how the tie was broken and what it cost in confidence.
- **Confidence gating.** Assembled from source authority, corroboration, conflict
  penalty, the critic verdict and the quality of the reader. At or above 92% a
  value publishes; between 60% and 92% it goes to a human review queue; below
  that it is dropped.

### Working with the data

- **Ask the datasheet.** Grounded question answering over a product's documents,
  with cited spans — and an honest *"not found in the provided sources"* when
  the documents do not say.
- **Comparison copilot.** Describe an application in plain words; it parses hard
  and soft constraints, scores candidates on published data only, and explains
  the pick. `UNKNOWN` is kept distinct from `FAILS`, because a gap in the
  evidence is not a defect in the product.
- **Product knowledge graph.** Brands, categories, shared attributes,
  certifications, product families, alternatives and mating parts — every edge
  derived from published values.
- **Commerce output.** Product title, feature bullets, meta description, trade
  synonyms and storefront facets, composed from published attributes only.
- **Search impact view.** The same storefront query against raw supplier rows
  versus enriched records, side by side.
- **Workspace.** Your catalogue is what you have enriched, held in the browser.
  A bundled sample set is available behind an explicit action and is always
  labelled as samples.

### Product

- Runs fully **without an API key** on a deterministic path, so it deploys and
  demos with an empty environment. A model key upgrades quality; it is never a
  dependency for the app to function.
- **Google Gemini** and **Anthropic Claude** both supported behind one interface.
- Light and dark themes, responsive layout, respects `prefers-reduced-motion`.
- Streaming pipeline trace over Server-Sent Events, so each of the eight stages
  reports as it lands.

---

## Setup

### Requirements

Node.js 20.9 or newer.

### Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000. No configuration is required — the engine runs
deterministically against the bundled evidence corpus.

### Enabling the live model

Create `.env.local`:

```bash
GEMINI_API_KEY=your-key-here
```

That is the only required variable. Everything else has a working default:

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Enables the live path |
| `GEMINI_MODEL` | `gemini-3.1-pro-preview` | Extraction, critique, commerce copy |
| `GEMINI_FAST_MODEL` | `gemini-3.7-flash` | Classification, normalisation |
| `ANTHROPIC_API_KEY` | — | Alternative provider |
| `LLM_PROVIDER` | auto-detect | Force `gemini` or `anthropic` |
| `NEXT_PUBLIC_SITE_URL` | auto-detect | Canonical origin for Open Graph |

Do not paste this table into a hosting provider's environment editor — blank
values are not the same as absent ones. Add only the keys you actually set.

If a model call fails for any reason, the run falls back to the deterministic
path and is marked `demo corpus` in the UI rather than failing.

### Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
```

### Deployment

Push to GitHub and import the repository at
[vercel.com/new](https://vercel.com/new). Everything is detected from
`vercel.json`; **no environment variables are required to deploy**. Add
`GEMINI_API_KEY` afterwards to switch on the live model, then redeploy.

---

## Project layout

```
src/
  app/              routes and API handlers
    api/            enrich · ingest · ask · catalog · samples
  components/       console · ask · compare · graph · search · site · ui
  data/             PVF taxonomy, evidence corpus, variant tables
  lib/
    pipeline/       classify · extract · validate · resolve · compose · ask · compare
    units.ts        unit and vocabulary normalisation
    graph.ts        knowledge graph construction
    workspace.ts    browser-held catalogue
public/
  intro.mp4         landing-page intro, plays once per day per browser
demo/               sample PDFs for demonstrating the upload path
```

### Demo assets

`demo/` contains two PDFs with real text layers describing a product that is
**not** in the bundled catalogue, so uploading them exercises genuine
extraction rather than a lookup. Both companies are fictional.

| File | Attach as |
| --- | --- |
| `1-Meridian-V500-datasheet.pdf` | Manufacturer datasheet |
| `2-Ridgeline-distributor-listing.pdf` | Distributor listing |

Enter the supplier row `Meridian Flow Control` / `V500-200-SW` /
`BALL VLV 2 3PC CS SW FP GEAR`. Attaching the datasheet alone leaves every
value in review, because one machine-read source corroborated by nothing
cannot clear the publish gate. Adding the distributor listing pushes the
agreeing values through and refutes the two the listing gets wrong — its
pressure rating and its ball material.

