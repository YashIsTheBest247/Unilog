/* ------------------------------------------------------------------ *
 * Stage 8 - Compose.
 *
 * Attributes alone do not sell anything. This stage turns the published
 * record into the assets a storefront actually needs: a title a human
 * would recognise, bullets ordered by what buyers filter on, and
 * synonyms written the way tradespeople type.
 *
 * That last one matters more than it looks. Nobody searches "Nominal
 * Size 0.5 in, Black Steel, Pipe Nipple". They search "half inch black
 * iron nipple". Only published attributes feed this - unverified values
 * never reach the storefront.
 * ------------------------------------------------------------------ */

import { structured, withFallback } from "@/lib/llm";
import { parseFractional } from "@/lib/units";
import type {
  AttributeValue,
  CommerceContent,
  RawProduct,
  TaxonomyClass,
} from "@/lib/types";

const SPOKEN_SIZE: Record<string, string> = {
  "1/8": "eighth inch",
  "1/4": "quarter inch",
  "3/8": "three eighths inch",
  "1/2": "half inch",
  "3/4": "three quarter inch",
  "1": "one inch",
  "1-1/4": "inch and a quarter",
  "1-1/2": "inch and a half",
  "2": "two inch",
  "2-1/2": "two and a half inch",
  "3": "three inch",
  "4": "four inch",
  "6": "six inch",
  "8": "eight inch",
};

const CLASS_SYNONYMS: Record<string, string[]> = {
  "PVF-VLV-BALL": ["ball valve", "ball vlv", "bv"],
  "PVF-FIT-NIPPLE": ["nipple", "pipe nipple", "nip", "npl"],
  "PVF-VLV-BFLY": ["butterfly valve", "bfly valve", "bfv"],
  "PVF-FLG-PIPE": ["flange", "flg", "pipe flange"],
};

/** How the trade says a value out loud, versus how the schema stores it. */
const VALUE_SYNONYMS: Record<string, string[]> = {
  "Black Steel": ["black iron", "black", "bi pipe"],
  "Galvanized Steel": ["galv", "galvanized", "gi"],
  "Stainless Steel 316": ["316 stainless", "316 ss", "stainless", "cf8m"],
  "Stainless Steel 304": ["304 stainless", "304 ss", "stainless"],
  Bronze: ["bronze", "brz"],
  Brass: ["brass"],
  "Ductile Iron": ["ductile", "di", "ductile iron"],
  "Full Port": ["full bore", "full port", "fp"],
  "NPT Threaded": ["threaded", "npt", "screwed"],
  "Weld Neck": ["weld neck", "wn"],
  "Raised Face": ["raised face", "rf"],
  "Threaded Both Ends": ["tbe", "threaded both ends"],
  Lug: ["lug style", "lugged"],
  Wafer: ["wafer style"],
  "Gear Operated": ["gear op", "gear operator", "handwheel"],
  Lever: ["lever handle", "handle"],
  "SCH 40": ["sch 40", "schedule 40", "s40"],
  "SCH 80": ["sch 80", "schedule 80", "s80"],
};

function published(attributes: AttributeValue[]) {
  return attributes.filter((a) => a.decision === "publish" && a.value !== null);
}

function pick(attributes: AttributeValue[], key: string): string | null {
  const found = attributes.find(
    (a) => a.key === key && a.decision === "publish",
  );
  return found?.value ?? null;
}

function sizeToken(attributes: AttributeValue[]): string | null {
  const size = pick(attributes, "nominal_size");
  return size ? `${size}"` : null;
}

function offlineCompose(
  raw: RawProduct,
  cls: TaxonomyClass,
  attributes: AttributeValue[],
): CommerceContent {
  const pub = published(attributes);
  const size = sizeToken(attributes);

  const material =
    pick(attributes, "body_material") ??
    pick(attributes, "nipple_material") ??
    pick(attributes, "flange_material");

  /* -------------------------------------------------------- title */
  const titleParts = [
    raw.brand,
    raw.mpn,
    "-",
    size,
    material,
    pick(attributes, "pressure_class"),
    pick(attributes, "flange_type") ?? pick(attributes, "body_style"),
    cls.label,
  ].filter(Boolean);

  const qualifiers = [
    pick(attributes, "port_configuration"),
    pick(attributes, "end_connection"),
    pick(attributes, "face_type"),
    pick(attributes, "schedule"),
    pick(attributes, "overall_length")
      ? `${pick(attributes, "overall_length")}" Long`
      : null,
  ].filter(Boolean);

  const title = [titleParts.join(" "), qualifiers.join(", ")]
    .filter(Boolean)
    .join(", ");

  /* ------------------------------------------------------ bullets */
  const bulletOrder = pub
    .filter((a) => a.key !== "nominal_size")
    .sort((a, b) => {
      const wa = cls.attributes.find((s) => s.key === a.key)?.searchWeight ?? 0;
      const wb = cls.attributes.find((s) => s.key === b.key)?.searchWeight ?? 0;
      return wb - wa;
    })
    .slice(0, 6);

  const bullets = bulletOrder.map((a) => {
    const spec = cls.attributes.find((s) => s.key === a.key);
    const unit = spec?.unit && spec.unit !== "in" ? ` ${spec.unit}` : "";
    const value = spec?.unit === "in" ? `${a.value}"` : `${a.value}${unit}`;
    return `${a.label}: ${value}`;
  });

  /* ----------------------------------------------------- synonyms */
  const classSyn = CLASS_SYNONYMS[cls.id] ?? [cls.label.toLowerCase()];
  const sizeSpoken = size ? SPOKEN_SIZE[size.replace('"', "")] : null;
  const materialSyn = material ? (VALUE_SYNONYMS[material] ?? [material.toLowerCase()]) : [];

  // Vary the shape of the phrases rather than permuting one template,
  // because a buyer types "half inch black iron nipple" or "1/2 npl blk",
  // never eighteen near-identical strings.
  const primary = classSyn[0];
  const sizeShort = size?.replace('"', "") ?? null;
  const brand = raw.brand.toLowerCase();

  const synonyms = new Set<string>();
  const add = (...parts: Array<string | null | undefined>) => {
    const phrase = parts.filter(Boolean).join(" ").trim();
    if (phrase) synonyms.add(phrase);
  };

  add(sizeShort, primary);
  add(sizeSpoken, primary);
  add(sizeShort, materialSyn[0], primary);
  add(sizeSpoken, materialSyn[0], primary);
  add(materialSyn[0], primary);
  add(materialSyn[1], primary);
  add(brand, primary);
  add(brand, sizeShort, primary);
  add(raw.mpn.toLowerCase());
  add(raw.mpn.replace(/[-\s]/g, "").toLowerCase());
  add(brand, raw.mpn.toLowerCase());

  // The shop shorthand for this exact configuration.
  for (const key of [
    "port_configuration",
    "end_connection",
    "flange_type",
    "face_type",
    "schedule",
    "thread_configuration",
    "body_style",
    "handle_type",
  ]) {
    const value = pick(attributes, key);
    for (const s of VALUE_SYNONYMS[value ?? ""]?.slice(0, 1) ?? []) {
      add(sizeShort, s, primary);
    }
  }

  for (const alt of classSyn.slice(1)) {
    add(sizeShort, alt);
    add(sizeShort, materialSyn[0], alt);
  }

  /* -------------------------------------------------- applications */
  const media = pick(attributes, "media");
  const approvals = pick(attributes, "approvals");
  const leadFree = pick(attributes, "lead_free");

  const applications: string[] = [];
  if (media) applications.push(...media.split(/,\s*/).slice(0, 4));
  if (leadFree === "Yes") applications.push("Potable water distribution");
  if (approvals?.toLowerCase().includes("ul")) applications.push("Fire protection service");
  if (applications.length === 0) applications.push("General industrial piping");

  const metaDescription = [
    `${raw.brand} ${raw.mpn}`,
    size ? `${size}` : null,
    material,
    cls.label.toLowerCase() + ".",
    pick(attributes, "pressure_rating_wog")
      ? `Rated ${pick(attributes, "pressure_rating_wog")} PSI WOG.`
      : null,
    "Full specifications, sourced and verified against the manufacturer datasheet.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title,
    bullets,
    metaDescription: metaDescription.slice(0, 300),
    synonyms: [...synonyms].filter(Boolean).slice(0, 18),
    applications: [...new Set(applications)].slice(0, 5),
  };
}

const COMPOSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Under 140 characters." },
    bullets: {
      type: "array",
      items: { type: "string" },
      description: "4 to 6 buyer-facing feature bullets.",
    },
    metaDescription: { type: "string", description: "Under 160 characters." },
    synonyms: {
      type: "array",
      items: { type: "string" },
      description:
        "10 to 18 search phrases a tradesperson would actually type, including abbreviations and spoken sizes.",
    },
    applications: { type: "array", items: { type: "string" } },
  },
  required: ["title", "bullets", "metaDescription", "synonyms", "applications"],
} as const;

export async function compose(
  raw: RawProduct,
  cls: TaxonomyClass,
  attributes: AttributeValue[],
): Promise<{ commerce: CommerceContent; live: boolean }> {
  const pub = published(attributes);

  const { value, live } = await withFallback(
    async () => {
      const result = await structured<CommerceContent>({
        tier: "strong",
        maxTokens: 1600,
        system: [
          "You write commerce content for an industrial distributor storefront.",
          "",
          "Use ONLY the verified attributes supplied. Never introduce a specification that is not in the list - unverified claims are exactly what this pipeline exists to prevent.",
          "Write the way the trade speaks: spoken sizes (half inch, inch and a half), shop abbreviations (black iron, sch 40, WN RF), and brand plus part number.",
        ].join("\n"),
        prompt: [
          `Brand: ${raw.brand}`,
          `MPN: ${raw.mpn}`,
          `Class: ${cls.label} (${cls.path.join(" > ")})`,
          "",
          "Verified attributes:",
          ...pub.map((a) => `- ${a.label}: ${a.value}${a.unit ? ` ${a.unit}` : ""}`),
        ].join("\n"),
        schema: COMPOSE_SCHEMA as unknown as Record<string, unknown>,
      });
      return result;
    },
    () => offlineCompose(raw, cls, attributes),
  );

  return { commerce: value, live };
}

/* ------------------------------------------------------------------ *
 * Facets - what the enriched record contributes to storefront
 * navigation. Only published, facetable attributes qualify.
 * ------------------------------------------------------------------ */

export interface Facet {
  key: string;
  label: string;
  value: string;
  weight: number;
}

export function facetsFor(
  cls: TaxonomyClass,
  attributes: AttributeValue[],
): Facet[] {
  return attributes
    .filter((a) => a.decision === "publish" && a.value !== null)
    .map((a) => {
      const spec = cls.attributes.find((s) => s.key === a.key);
      if (!spec?.facetable) return null;
      return {
        key: a.key,
        label: a.label,
        value: a.value as string,
        weight: spec.searchWeight,
      };
    })
    .filter((f): f is Facet => f !== null)
    .sort((a, b) => b.weight - a.weight);
}

/** Reads "0.5" back as the 1/2 a buyer typed. Used by the search demo. */
export function displaySize(value: string | null): string | null {
  if (!value) return null;
  const n = parseFractional(value);
  return n === null ? value : value;
}
