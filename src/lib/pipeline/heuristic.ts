/* ------------------------------------------------------------------ *
 * Heuristic extraction.
 *
 * The bundled corpus carries pre-annotated claims. Anything a user
 * uploads does not, and without a model key there is nothing to read it
 * with - so this is the deterministic reader for arbitrary text.
 *
 * It works line by line, which is deliberate: an industrial datasheet
 * is mostly a list of "Label ....... Value" rows and dimension tables,
 * and a line is both a good extraction window and a quote guaranteed to
 * be a literal substring of the source. Provenance stays exact even
 * when the extractor is dumb.
 *
 * Two passes, and the order matters. The first only reads lines that
 * name the attribute being looked for. Only afterwards, for attributes
 * still empty, does it consider unlabelled lines - and never a line
 * already claimed by some other attribute's label. Without that rule
 * "Body ... forged carbon steel" gets read as the ball material, the
 * stem material and the seat material too, because every one of them
 * accepts a material name.
 * ------------------------------------------------------------------ */

import { normalizeValue } from "@/lib/units";
import type { AttributeSpec, SourceClaim, TaxonomyClass } from "@/lib/types";

/** Trade shorthand a label alone would never match. */
const EXTRA_CUES: Record<string, string[]> = {
  nominal_size: ["nps", "nominal size", "size", "dn", "nom. size", "valve size"],
  overall_length: ["length", "overall length", "long"],
  pressure_rating_wog: [
    "wog",
    "cwp",
    "working pressure",
    "pressure rating",
    "cold working",
    "max pressure",
  ],
  pressure_rating_steam: ["wsp", "steam", "saturated steam"],
  temperature_max: [
    "max temp",
    "maximum temperature",
    "temperature range",
    "temperature",
  ],
  temperature_min: ["min temp", "minimum temperature", "temperature range"],
  body_material: ["body", "body material"],
  nipple_material: ["material", "finish", "barrel"],
  flange_material: ["grade", "forging", "material"],
  ball_material: ["ball"],
  disc_material: ["disc"],
  seat_material: ["seat", "seats", "liner"],
  stem_material: ["stem", "shaft"],
  end_connection: ["ends", "end connection", "connection", "connections"],
  thread_type: ["thread", "threads"],
  thread_configuration: ["ends", "threaded"],
  port_configuration: ["port", "bore"],
  body_construction: ["piece", "body style", "construction"],
  body_style: ["body", "style", "body style"],
  handle_type: ["operator", "handle", "actuator", "actuation"],
  schedule: ["schedule", "sch"],
  bore_schedule: ["bore", "schedule"],
  pressure_class: ["class", "rating"],
  flange_type: ["type", "flange type"],
  face_type: ["face", "facing"],
  bolt_hole_count: ["bolt holes", "holes", "no. of bolts", "number of bolts"],
  bolt_circle_diameter: ["bolt circle", "b.c.", "bcd"],
  bolt_hole_diameter: ["hole dia", "bolt hole diameter", "hole diameter"],
  outside_diameter: ["o.d.", "od", "outside diameter", "outer diameter"],
  flange_thickness: ["thickness", "thk"],
  wall_thickness: ["wall", "wall thickness"],
  weight: ["weight", "mass", "wt"],
  cv_flow: ["cv", "flow coefficient"],
  approvals: [
    "approvals",
    "certifications",
    "listed",
    "approved",
    "certified",
    "standards",
    "conforms",
    "fire safe",
  ],
  lead_free: ["lead free", "nsf", "potable"],
  domestic_origin: ["domestic", "buy american", "ais"],
  country_of_origin: [
    "country of origin",
    "made in",
    "manufactured in",
    "product of",
  ],
  astm_spec: ["astm", "asme", "specification", "conforms"],
  standard: ["standard", "standards", "ansi", "api", "mss"],
  manufacturing_process: ["welded", "seamless", "process"],
  media: ["media", "service", "suitable for", "fluids"],
  locking_handle: ["locking", "lockout", "padlock"],
  stem_design: ["blowout", "anti-static", "stem design"],
  face_to_face: ["face to face", "face-to-face"],
  flange_standard: ["drilling", "b16.1", "b16.5", "flange compatibility"],
  surface_finish: ["finish", "aarh", "serrated"],
};

function cuesFor(spec: AttributeSpec): string[] {
  const fromLabel = spec.label
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .trim();
  const fromKey = spec.key.replace(/_/g, " ");
  return [
    ...new Set([fromLabel, fromKey, ...(EXTRA_CUES[spec.key] ?? [])]),
  ].filter((c) => c.length >= 2);
}

/** Word-ish containment so "od" does not match "product". */
function mentions(line: string, cue: string) {
  const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(line);
}

const DEGREE = "°";
const UNIT_GROUP = `(inches|inch|in\\b|"|mm|cm|ft|psig|psi|bar|kpa|mpa|${DEGREE}?\\s?[FC]\\b|lbs?|kg|g\\b)?`;
const NUMBER_GROUP = `(-?\\d+(?:[-\\s]\\d+\\/\\d+)?(?:\\.\\d+)?|\\d+\\/\\d+)`;

function allNumbers() {
  return new RegExp(`${NUMBER_GROUP}\\s*${UNIT_GROUP}`, "gi");
}

const DN_SIZE = /\bDN\s?\d+\b/i;
const RANGE_HINT = /\brange\b|\bto\b|\bthru\b|\.\.\.|–|—/i;

/**
 * Pull a plausible magnitude out of one line.
 *
 * Ranges are the trap. "Temperature range -20 F to 400 F" carries both
 * ends of the spec on one line, and taking the first number makes the
 * maximum temperature -20 F - a value that would get a valve specified
 * into service it cannot survive.
 */
function numericFrom(spec: AttributeSpec, line: string): string | null {
  if (spec.unitFamily === "length") {
    const dn = line.match(DN_SIZE);
    if (dn) return dn[0];
  }

  const found: string[] = [];
  for (const m of line.matchAll(allNumbers())) {
    const raw = m[2] ? `${m[1]} ${m[2]}` : m[1];
    if (normalizeValue(spec, raw).value !== null) found.push(raw);
  }

  if (found.length === 0) return null;
  if (found.length === 1) return found[0];

  if (RANGE_HINT.test(line)) {
    const scored = found
      .map((raw) => ({
        raw,
        n: Number(normalizeValue(spec, raw).value?.replace(/[^\d.-]/g, "")),
      }))
      .filter((x) => Number.isFinite(x.n));

    if (scored.length > 1) {
      if (spec.key.endsWith("_max")) {
        return scored.reduce((a, b) => (b.n > a.n ? b : a)).raw;
      }
      if (spec.key.endsWith("_min")) {
        return scored.reduce((a, b) => (b.n < a.n ? b : a)).raw;
      }
    }
  }

  return found[0];
}

/** "Manufactured in Canada." -> "Canada" */
function originFrom(line: string): string | null {
  const m = line.match(
    /(?:made|manufactured|produced|assembled)\s+in\s+(?:the\s+)?([A-Za-z .]+?)\s*[.,]?$|product\s+of\s+([A-Za-z .]+?)\s*[.,]?$/i,
  );
  const value = (m?.[1] ?? m?.[2])?.trim();
  return value && value.length >= 2 && value.length <= 40 ? value : null;
}

function enumFrom(spec: AttributeSpec, line: string): string | null {
  // Whole segments first, longest first, through the normalizer's alias
  // table. This has to run before the literal scan below, because
  // "Reinforced PTFE" contains the substring PTFE - and reading it as
  // plain PTFE quietly drops a seat's rating from 450 F to 250 F.
  const segments = line
    .split(/[,;|]|\s{2,}|\.{2,}/)
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9)]+$/gi, "").trim())
    .filter((t) => t.length >= 2 && t.length <= 40)
    .sort((a, b) => b.length - a.length);

  for (const segment of segments) {
    if (normalizeValue(spec, segment).value !== null) return segment;
  }

  // Then a literal scan for an allowed value stated inline, most
  // specific candidate first.
  const bySpecificity = [...(spec.values ?? [])].sort(
    (a, b) => b.length - a.length,
  );
  for (const candidate of bySpecificity) {
    if (mentions(line, candidate)) return candidate;
  }

  return null;
}

function booleanFrom(line: string): string | null {
  if (
    /\b(not|non|no)\b[^.]{0,30}(certified|listed|approved|free|rated|domestic)/i.test(
      line,
    )
  ) {
    return "No";
  }
  if (
    /\b(certified|listed|approved|compliant|conforms|yes|included|standard)\b/i.test(
      line,
    )
  ) {
    return "Yes";
  }
  return null;
}

function textFrom(line: string, cues: string[]): string | null {
  // "Approvals ....... UL, FM, CSA" -> the right hand side.
  const split = line.split(/\.{3,}|:\s|\s{3,}|\t/).filter(Boolean);
  const tail = (split.length > 1 ? split[split.length - 1] : line).trim();

  // A section heading is its own cue and carries no value. "APPROVALS"
  // alone on a line is a label, not an approval.
  if (cues.some((c) => c.toLowerCase() === tail.toLowerCase())) return null;
  if (!/[a-z0-9]/i.test(tail)) return null;

  return tail.length >= 2 && tail.length <= 160 ? tail : null;
}

function valueFrom(
  spec: AttributeSpec,
  line: string,
  cues: string[],
): string | null {
  if (spec.key === "country_of_origin") {
    return originFrom(line) ?? textFrom(line, cues);
  }
  if (spec.type === "enum") return enumFrom(spec, line);
  if (spec.type === "boolean") return booleanFrom(line);
  if (spec.type === "text") return textFrom(line, cues);
  return numericFrom(spec, line);
}

export interface HeuristicOptions {
  /** Cap per attribute so one repetitive table cannot flood the pool. */
  maxPerKey?: number;
}

/**
 * Read arbitrary source text against a class schema.
 *
 * Every returned quote is a trimmed line taken verbatim from `text`, so
 * the caller can anchor it with indexOf and highlighting still lands on
 * real characters.
 */
export function heuristicClaims(
  cls: TaxonomyClass,
  text: string,
  options: HeuristicOptions = {},
): SourceClaim[] {
  const { maxPerKey = 2 } = options;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2 && l.length <= 300);

  const cueTable = new Map(cls.attributes.map((a) => [a.key, cuesFor(a)]));

  /** Which attributes each line names, so pass two can avoid them. */
  const cuedBy = lines.map((line) => {
    const keys = new Set<string>();
    for (const [key, cues] of cueTable) {
      if (cues.some((c) => mentions(line, c))) keys.add(key);
    }
    return keys;
  });

  const claims: SourceClaim[] = [];
  const counts = new Map<string, number>();

  const take = (spec: AttributeSpec, line: string, raw: string) => {
    if (normalizeValue(spec, raw).value === null) return false;
    claims.push({ key: spec.key, raw, quote: line });
    counts.set(spec.key, (counts.get(spec.key) ?? 0) + 1);
    return true;
  };

  /* -------- pass 1: only lines that name the attribute ------------- */
  for (const spec of cls.attributes) {
    const cues = cueTable.get(spec.key) ?? [];
    for (let i = 0; i < lines.length; i++) {
      if ((counts.get(spec.key) ?? 0) >= maxPerKey) break;
      if (!cuedBy[i].has(spec.key)) continue;

      const raw = valueFrom(spec, lines[i], cues);
      if (raw) take(spec, lines[i], raw);
    }
  }

  /* -------- pass 2: unlabelled lines, enums only ------------------- */
  // "RPTFE" on a line of its own is self-identifying. But a line that
  // already belongs to a different attribute is off limits, which is
  // what stops the body material from being read as the ball material.
  for (const spec of cls.attributes) {
    if (spec.type !== "enum") continue;
    if ((counts.get(spec.key) ?? 0) > 0) continue;

    const cues = cueTable.get(spec.key) ?? [];
    for (let i = 0; i < lines.length; i++) {
      if ((counts.get(spec.key) ?? 0) >= 1) break;
      if (cuedBy[i].size > 0) continue;

      const raw = enumFrom(spec, lines[i]);
      if (raw) take(spec, lines[i], cues.length ? raw : raw);
    }
  }

  return claims;
}
