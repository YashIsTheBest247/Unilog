/* ------------------------------------------------------------------ *
 * Unit normalization.
 *
 * Industrial data is a mess of fractional inches, decimal inches, DN
 * sizes and millimetres — often three of them for the same dimension in
 * the same record. Everything gets pulled to one canonical unit per
 * family so "1/2\"", "0.5 in" and "12.7 mm" stop being three values.
 * ------------------------------------------------------------------ */

import type { AttributeSpec, UnitFamily } from "./types";

const LENGTH_TO_IN: Record<string, number> = {
  in: 1,
  '"': 1,
  inch: 1,
  inches: 1,
  ft: 12,
  mm: 1 / 25.4,
  cm: 1 / 2.54,
  m: 1000 / 25.4,
};

const PRESSURE_TO_PSI: Record<string, number> = {
  psi: 1,
  psig: 1,
  bar: 14.5038,
  kpa: 0.145038,
  mpa: 145.038,
  kgcm2: 14.2233,
};

const TEMP_TO_F: Record<string, (n: number) => number> = {
  f: (n) => n,
  c: (n) => (n * 9) / 5 + 32,
  k: (n) => ((n - 273.15) * 9) / 5 + 32,
};

const FAMILY_CANONICAL: Record<UnitFamily, string> = {
  length: "in",
  pressure: "psi",
  temperature: "F",
  mass: "lb",
  flow: "Cv",
};

/** "1-1/2", "1 1/2", "3/4" and "0.75" all become 0.75-style decimals. */
export function parseFractional(input: string): number | null {
  const s = input.trim().replace(/[",]/g, "").replace(/\s+/g, " ");

  const mixed = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const [, w, n, d] = mixed;
    return Number(w) + Number(n) / Number(d);
  }

  const hyphenMixed = s.match(/^(-?\d+)-(\d+)\/(\d+)$/);
  if (hyphenMixed) {
    const [, w, n, d] = hyphenMixed;
    return Number(w) + Number(n) / Number(d);
  }

  const frac = s.match(/^(-?\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);

  const dec = s.match(/^-?\d*\.?\d+$/);
  if (dec) return Number(s);

  return null;
}

/**
 * DN is a nominal designation, not a measurement. DN 15 is 1/2 in NPS,
 * not 15 mm converted to 0.591 in - getting this wrong manufactures a
 * conflict between two sources that actually agree.
 */
const DN_TO_NPS: Record<number, number> = {
  6: 0.125, 8: 0.25, 10: 0.375, 15: 0.5, 20: 0.75, 25: 1,
  32: 1.25, 40: 1.5, 50: 2, 65: 2.5, 80: 3, 90: 3.5, 100: 4,
  125: 5, 150: 6, 200: 8, 250: 10, 300: 12, 350: 14, 400: 16,
  450: 18, 500: 20, 600: 24,
};

interface Split {
  magnitude: number;
  unit: string;
  /** Set when the raw form was a designation rather than a measurement. */
  designation?: boolean;
}

/** Pull a number and a unit token out of a free-text value. */
function splitValue(raw: string): Split | null {
  const s = raw.trim().replace(/\s+/g, " ");

  const dn = s.match(/^DN\s?(\d+)$/i);
  if (dn) {
    const nps = DN_TO_NPS[Number(dn[1])];
    if (nps !== undefined)
      return { magnitude: nps, unit: "in", designation: true };
    return { magnitude: Number(dn[1]), unit: "mm" };
  }

  const m = s.match(
    /^(-?[\d./\s-]+?)\s*(inches|inch|in\b|"|ft|mm|cm|m\b|psig|psi|bar|kpa|mpa|kg\/cm2|°?f\b|°?c\b|k\b|lb|lbs|kg|cv|kv)?\.?$/i,
  );
  if (!m) return null;

  const magnitude = parseFractional(m[1]);
  if (magnitude === null) return null;

  const unit = (m[2] ?? "")
    .toLowerCase()
    .replace(/°/g, "")
    .replace("kg/cm2", "kgcm2")
    .replace("inches", "in")
    .replace("inch", "in")
    .replace("lbs", "lb")
    .trim();

  return { magnitude, unit };
}

export interface NormalizedNumber {
  value: number;
  unit: string;
  converted: boolean;
}

export function normalizeNumeric(
  raw: string,
  family: UnitFamily,
): NormalizedNumber | null {
  const split = splitValue(raw);
  if (!split) return null;

  const canonical = FAMILY_CANONICAL[family];
  const { magnitude, unit } = split;

  if (family === "length") {
    const factor = LENGTH_TO_IN[unit || "in"];
    if (factor === undefined) return null;
    return {
      value: round(magnitude * factor, 4),
      unit: canonical,
      converted:
        split.designation === true ||
        (Boolean(unit) && unit !== "in" && unit !== '"'),
    };
  }

  if (family === "pressure") {
    const factor = PRESSURE_TO_PSI[unit || "psi"];
    if (factor === undefined) return null;
    return {
      value: round(magnitude * factor, 1),
      unit: canonical,
      converted: Boolean(unit) && unit !== "psi" && unit !== "psig",
    };
  }

  if (family === "temperature") {
    const fn = TEMP_TO_F[unit || "f"];
    if (!fn) return null;
    return {
      value: round(fn(magnitude), 1),
      unit: canonical,
      converted: Boolean(unit) && unit !== "f",
    };
  }

  return { value: round(magnitude, 3), unit: unit || canonical, converted: false };
}

function round(n: number, places: number) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** Render 0.5 back as 1/2" — how the trade actually reads pipe sizes. */
export function toTradeFraction(value: number): string {
  const whole = Math.floor(value);
  const remainder = value - whole;
  const denominators = [2, 4, 8, 16];

  for (const d of denominators) {
    const n = remainder * d;
    if (Math.abs(n - Math.round(n)) < 1e-6) {
      const num = Math.round(n);
      if (num === 0) return `${whole}`;
      return whole === 0 ? `${num}/${d}` : `${whole}-${num}/${d}`;
    }
  }
  return String(round(value, 3));
}

/* ------------------------------------------------------------------ *
 * Enum mapping.
 *
 * Nobody writes "Stainless Steel 316" in a datasheet. They write CF8M,
 * or A351 CF8M, or "Type 316 SS". These aliases are the difference
 * between a schema that fills and a schema that reports 60% gaps.
 * ------------------------------------------------------------------ */

const ENUM_ALIASES: Record<string, string> = {
  cf8m: "Stainless Steel 316",
  cf8: "Stainless Steel 304",
  "316ss": "Stainless Steel 316",
  "304ss": "Stainless Steel 304",
  "316l": "Stainless Steel 316",
  "type 316": "Stainless Steel 316",
  "type 304": "Stainless Steel 304",
  "type 316l": "Stainless Steel 316",
  "416 stainless steel": "Stainless Steel 416",
  "416 ss": "Stainless Steel 416",
  "silicon bronze": "Bronze",
  "lead free bronze": "Bronze",
  "lead free silicon bronze": "Bronze",
  ss: "Stainless Steel 304",
  blk: "Black Steel",
  "black iron": "Black Steel",
  bi: "Black Steel",
  galv: "Galvanized Steel",
  gi: "Galvanized Steel",
  "hot dipped galvanized": "Galvanized Steel",
  di: "Ductile Iron",
  npt: "NPT Threaded",
  fnpt: "NPT Threaded",
  mnpt: "NPT Threaded",
  bsp: "BSP Threaded",
  sw: "Socket Weld",
  bw: "Butt Weld",
  "reinforced ptfe": "RPTFE",
  "reinforced teflon": "RPTFE",
  tfe: "PTFE",
  "3pc": "3-Piece",
  "2pc": "2-Piece",
  "1pc": "1-Piece",
  "three piece": "3-Piece",
  "two piece": "2-Piece",
  fp: "Full Port",
  "full bore": "Full Port",
  rp: "Reduced Port",
  std: "Standard Port",
  tbe: "Threaded Both Ends",
  toe: "Threaded One End",
  pe: "Plain Both Ends",
  wn: "Weld Neck",
  so: "Slip-On",
  rf: "Raised Face",
  ff: "Flat Face",
  rtj: "Ring Type Joint",
  a105: "ASTM A105",
  "a182 f316": "ASTM A182 F316",
  "a182 f304": "ASTM A182 F304",
  "a350 lf2": "ASTM A350 LF2",
  epdm: "EPDM",
  "buna n": "Buna-N",
  nbr: "Buna-N",
  fkm: "Viton",
  gear: "Gear Operated",
  "gear operator": "Gear Operated",
  "lever handle": "Lever",
  "locking lever": "Lever",
};

function squash(s: string) {
  return s.toLowerCase().replace(/[\s._\-()/]/g, "");
}

function tokens(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

function mapEnum(raw: string, allowed: string[]): string | null {
  const lower = raw.toLowerCase().trim();

  // 1. Explicit alias, exact or as a leading token of the raw string.
  const aliasHit =
    ENUM_ALIASES[lower] ?? ENUM_ALIASES[squash(lower)] ?? undefined;
  if (aliasHit && allowed.includes(aliasHit)) return aliasHit;

  for (const [alias, canonical] of Object.entries(ENUM_ALIASES)) {
    if (!allowed.includes(canonical)) continue;
    const pattern = new RegExp(
      `(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
      "i",
    );
    if (pattern.test(lower)) return canonical;
  }

  // 2. Same words in a different order: "316 Stainless Steel".
  const rawTokens = tokens(raw);
  const reordered = allowed.find((v) => tokens(v) === rawTokens);
  if (reordered) return reordered;

  // 3. The candidate's words all appear in the raw string, which is how
  //    "ASTM A276 Type 316 Stainless Steel" resolves to "Stainless Steel
  //    316". Most specific candidate wins so 316 never loses to 304.
  const rawSet = new Set(rawTokens.split(" "));
  const subset = allowed
    .filter((v) => tokens(v).split(" ").every((t) => rawSet.has(t)))
    .sort((a, b) => tokens(b).split(" ").length - tokens(a).split(" ").length)[0];
  if (subset) return subset;

  // 4. The raw string contains a whole allowed value. Closest length
  //    wins, not longest - otherwise "150" resolves to Class 1500
  //    rather than Class 150, which is a 10x pressure error.
  const sq = squash(raw);
  const containsWhole = allowed
    .filter((v) => sq.includes(squash(v)))
    .sort(
      (a, b) =>
        Math.abs(squash(a).length - sq.length) -
        Math.abs(squash(b).length - sq.length),
    );
  if (containsWhole.length > 0) return containsWhole[0];

  // 5. A single token that is one of the allowed value's own words.
  //
  //    Token membership, not substring: "at" is a substring of "Chrome
  //    Plated Brass" and would otherwise resolve to it, and "316" needs
  //    to reach "Stainless Steel 316" without that licence. If the token
  //    fits more than one allowed value it is ambiguous - "stainless"
  //    belongs to both 304 and 316 - and guessing between them is worse
  //    than declining, because the guess is silent.
  const rawTokenList = rawTokens.split(" ");
  if (rawTokenList.length === 1 && rawTokenList[0].length >= 3) {
    const token = rawTokenList[0];
    const owners = allowed.filter((v) => tokens(v).split(" ").includes(token));
    if (owners.length === 1) return owners[0];
  }

  return null;
}

export interface NormalizationResult {
  value: string | null;
  converted: boolean;
  error?: string;
}

/** Coerce one raw string into the canonical form its spec demands. */
export function normalizeValue(
  spec: AttributeSpec,
  raw: string,
): NormalizationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, converted: false, error: "empty value" };

  if (spec.type === "boolean") {
    const yes = /^(yes|true|y|included|standard)$/i.test(trimmed);
    const no = /^(no|false|n|none|not included)$/i.test(trimmed);
    if (!yes && !no)
      return { value: null, converted: false, error: `not a boolean: "${trimmed}"` };
    return { value: yes ? "Yes" : "No", converted: false };
  }

  if (spec.type === "enum") {
    const allowed = spec.values ?? [];
    const exact = allowed.find((v) => v.toLowerCase() === trimmed.toLowerCase());
    if (exact) return { value: exact, converted: false };

    const mapped = mapEnum(trimmed, allowed);
    if (mapped) return { value: mapped, converted: true };

    return {
      value: null,
      converted: false,
      error: `"${trimmed}" is outside the allowed values for ${spec.label}`,
    };
  }

  if (spec.type === "dimension" || spec.type === "number") {
    // A plain count (bolt holes, for instance) carries no unit family and
    // must not be run through a length conversion.
    if (spec.type === "number" && !spec.unitFamily) {
      const n = parseFractional(trimmed.replace(/[^\d.\-/ ]/g, "").trim());
      if (n === null)
        return {
          value: null,
          converted: false,
          error: `could not parse "${trimmed}" as a number`,
        };
      if (spec.range && (n < spec.range[0] || n > spec.range[1]))
        return {
          value: null,
          converted: false,
          error: `${n} falls outside the plausible range ${spec.range[0]}-${spec.range[1]}`,
        };
      return { value: String(round(n, 3)), converted: false };
    }

    const family = spec.unitFamily ?? "length";
    const n = normalizeNumeric(trimmed, family);
    if (!n)
      return {
        value: null,
        converted: false,
        error: `could not parse "${trimmed}" as ${spec.label}`,
      };

    if (spec.range && (n.value < spec.range[0] || n.value > spec.range[1])) {
      return {
        value: null,
        converted: n.converted,
        error: `${n.value} ${n.unit} falls outside the plausible range ${spec.range[0]}–${spec.range[1]} ${n.unit}`,
      };
    }

    const display =
      family === "length" ? `${toTradeFraction(n.value)}` : `${n.value}`;
    return { value: display, converted: n.converted };
  }

  return { value: trimmed, converted: false };
}

/**
 * Two values that mean the same thing once units are stripped.
 *
 * Numerics get a 1% tolerance, because 138 bar and 2000 psi are the same
 * rating written by two different engineers, and flagging that as a
 * conflict would bury the disagreements that actually matter.
 */
export function areEquivalent(
  spec: AttributeSpec,
  a: string,
  b: string,
): boolean {
  const na = normalizeValue(spec, a).value;
  const nb = normalizeValue(spec, b).value;
  if (na === null || nb === null) return false;

  if (spec.type === "number" || spec.type === "dimension") {
    const fa = parseFractional(na);
    const fb = parseFractional(nb);
    if (fa !== null && fb !== null) {
      const scale = Math.max(Math.abs(fa), Math.abs(fb), 1e-6);
      return Math.abs(fa - fb) / scale <= 0.01;
    }
  }

  return na.toLowerCase() === nb.toLowerCase();
}
