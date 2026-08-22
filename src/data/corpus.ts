/* ------------------------------------------------------------------ *
 * Bundled evidence corpus.
 *
 * Live crawling on stage is a coin flip, so the sources every demo SKU
 * needs are cached here verbatim. Each source carries its excerpt plus
 * pre-annotated claims, which is what makes attribute-level provenance
 * exact rather than approximate: a claim's `quote` is a literal
 * substring of its `excerpt`, so the UI can highlight the precise span
 * a value came from.
 *
 * The corpus deliberately contains bad data. Distributor listings
 * disagree with datasheets, marketplace rows assert materials that are
 * flatly wrong, and the same dimension shows up in inches, fractions
 * and DN. That is the point - a validation layer with nothing to catch
 * proves nothing.
 * ------------------------------------------------------------------ */

import type { EvidenceSource, RawProduct } from "@/lib/types";
import { VARIANTS } from "./variants";
import type { VariantRow, VariantSpec } from "./variants";

export interface CorpusEntry {
  raw: RawProduct;
  /** Ground-truth class; the classifier still has to earn it. */
  expectedClass: string;
  sources: EvidenceSource[];
}

/* ================================================================== *
 * 1. Apollo 77C-143-01 - 1/2" three piece stainless ball valve
 * ================================================================== */

const apollo: CorpusEntry = {
  raw: {
    id: "sku-apollo-77c-143-01",
    mpn: "77C-143-01",
    brand: "Apollo",
    description: "BALL VLV 1/2 3PC SS FP LKG HDL",
    supplierCategory: "VALVES & ACTUATORS",
    listPrice: 148.2,
    uom: "EA",
  },
  expectedClass: "PVF-VLV-BALL",
  sources: [
    {
      id: "apollo-ds",
      kind: "manufacturer_datasheet",
      title: "Apollo 77C Series - Three Piece Stainless Steel Ball Valve",
      locator: "p.2 - Table 1 - row 77C-143-01",
      url: "https://apollovalves.example/docs/77C-series.pdf",
      retrievedAt: "2026-08-14T09:12:00Z",
      excerpt: `APOLLO 77C SERIES - THREE PIECE STAINLESS STEEL BALL VALVE

Investment cast body, full port design, in-line serviceable.

PRESSURE RATING
2000 PSI WOG cold non-shock service.
150 PSI WSP saturated steam.

MATERIALS OF CONSTRUCTION
  Body / End Caps ....... ASTM A351 CF8M
  Ball .................. ASTM A276 Type 316 Stainless Steel
  Stem .................. ASTM A276 Type 316, blowout proof design
  Seats ................. Reinforced PTFE
  Body Seal ............. Reinforced PTFE

END CONNECTIONS
  NPT threaded ends per ASME B1.20.1.

TEMPERATURE RANGE
  -20 F to 450 F continuous service with reinforced PTFE seats.

DIMENSIONAL DATA - TABLE 1
  Part No.       Size     Cv      Weight
  77C-142-01     3/8      12.5    0.94 lb
  77C-143-01     1/2      15.0    1.12 lb
  77C-144-01     3/4      32.0    1.78 lb
  77C-145-01     1        55.0    2.65 lb

OPERATOR
  Lever handle with integral locking device, vinyl coated.

APPROVALS
  MSS SP-110. CRN registered in all provinces.
  Manufactured in the U.S.A.`,
      claims: [
        { key: "pressure_rating_wog", raw: "2000 PSI", quote: "2000 PSI WOG cold non-shock service" },
        { key: "pressure_rating_steam", raw: "150 PSI", quote: "150 PSI WSP saturated steam" },
        { key: "body_material", raw: "ASTM A351 CF8M", quote: "Body / End Caps ....... ASTM A351 CF8M" },
        { key: "ball_material", raw: "Type 316 Stainless Steel", quote: "Ball .................. ASTM A276 Type 316 Stainless Steel" },
        { key: "stem_material", raw: "Type 316", quote: "Stem .................. ASTM A276 Type 316, blowout proof design" },
        { key: "stem_design", raw: "Blowout Proof", quote: "blowout proof design" },
        { key: "seat_material", raw: "Reinforced PTFE", quote: "Seats ................. Reinforced PTFE" },
        { key: "end_connection", raw: "NPT", quote: "NPT threaded ends per ASME B1.20.1" },
        { key: "temperature_max", raw: "450 F", quote: "-20 F to 450 F continuous service" },
        { key: "temperature_min", raw: "-20 F", quote: "-20 F to 450 F continuous service" },
        { key: "nominal_size", raw: "1/2", quote: "77C-143-01     1/2      15.0    1.12 lb" },
        { key: "cv_flow", raw: "15.0", quote: "77C-143-01     1/2      15.0    1.12 lb" },
        { key: "weight", raw: "1.12", quote: "77C-143-01     1/2      15.0    1.12 lb" },
        { key: "handle_type", raw: "Lever", quote: "Lever handle with integral locking device" },
        { key: "locking_handle", raw: "Yes", quote: "integral locking device" },
        { key: "approvals", raw: "MSS SP-110, CRN registered", quote: "MSS SP-110. CRN registered in all provinces." },
        { key: "astm_spec", raw: "ASTM A351 CF8M", quote: "ASTM A351 CF8M" },
        { key: "country_of_origin", raw: "United States", quote: "Manufactured in the U.S.A." },
        { key: "port_configuration", raw: "Full Port", quote: "full port design" },
        { key: "body_construction", raw: "Three Piece", quote: "THREE PIECE STAINLESS STEEL BALL VALVE" },
      ],
    },
    {
      id: "apollo-web",
      kind: "manufacturer_web",
      title: "Apollo Valves - 77C-143-01 product page",
      locator: "Specifications tab",
      url: "https://apollovalves.example/products/77C-143-01",
      retrievedAt: "2026-08-14T09:12:04Z",
      excerpt: `77C-143-01 | 1/2 in. Three Piece Stainless Steel Ball Valve

The 77C is a swing-out, in-line serviceable three piece ball valve for
process and utility service. Full port bore keeps pressure drop low.

Quick specs
  Size: 1/2 in.
  Body: 316 Stainless Steel
  Port: Full Port
  Ends: NPT Threaded
  Pressure: 2000 WOG
  Seats: RPTFE
  Handle: Locking lever
  Media: Water, oil, gas, steam, and most process chemicals

This valve is not certified to NSF/ANSI 372 and should not be specified
for potable water distribution.`,
      claims: [
        { key: "nominal_size", raw: "1/2 in.", quote: "Size: 1/2 in." },
        { key: "body_material", raw: "316 Stainless Steel", quote: "Body: 316 Stainless Steel" },
        { key: "port_configuration", raw: "Full Port", quote: "Port: Full Port" },
        { key: "end_connection", raw: "NPT Threaded", quote: "Ends: NPT Threaded" },
        { key: "pressure_rating_wog", raw: "2000", quote: "Pressure: 2000 WOG" },
        { key: "seat_material", raw: "RPTFE", quote: "Seats: RPTFE" },
        { key: "handle_type", raw: "Locking lever", quote: "Handle: Locking lever" },
        { key: "media", raw: "Water, oil, gas, steam, and most process chemicals", quote: "Media: Water, oil, gas, steam, and most process chemicals" },
        { key: "lead_free", raw: "No", quote: "not certified to NSF/ANSI 372" },
        { key: "body_construction", raw: "Three Piece", quote: "Three Piece Stainless Steel Ball Valve" },
      ],
    },
    {
      id: "apollo-cat",
      kind: "catalog_pdf",
      title: "PVF Master Catalog 2026 - Stainless Ball Valves",
      locator: "p.214 - metric dimension table",
      url: "https://catalog.example/pvf-2026.pdf#page=214",
      retrievedAt: "2026-08-14T09:12:09Z",
      excerpt: `STAINLESS BALL VALVES - METRIC DIMENSIONAL DATA

  Cat. No.        Nom. Size    A (mm)   B (mm)   Mass (kg)
  77C-142-01      DN 10        58.0     42.5     0.43
  77C-143-01      DN 15        66.5     46.0     0.51
  77C-144-01      DN 20        79.0     52.5     0.81

  Working pressure 138 bar WOG at 20 C.
  Seat material: reinforced PTFE. Body: CF8M.`,
      claims: [
        { key: "nominal_size", raw: "DN 15", quote: "77C-143-01      DN 15" },
        { key: "pressure_rating_wog", raw: "138 bar", quote: "Working pressure 138 bar WOG at 20 C" },
        { key: "seat_material", raw: "reinforced PTFE", quote: "Seat material: reinforced PTFE" },
        { key: "body_material", raw: "CF8M", quote: "Body: CF8M" },
      ],
    },
    {
      id: "apollo-dist",
      kind: "distributor_listing",
      title: "Regional supply house - Apollo 77C-143-01",
      locator: "product detail page",
      url: "https://supplyhouse.example/p/apollo-77c-143-01",
      retrievedAt: "2026-08-14T09:12:15Z",
      excerpt: `Apollo 77C-143-01 1/2" Stainless Ball Valve, 3 Piece

Heavy duty stainless ball valve for industrial service.
Rated 1000 WOG. Full port. NPT threads. Lever handle.
Temperature to 450F. Stainless steel ball and stem.
Ships from stock. Country of origin: USA.`,
      claims: [
        { key: "pressure_rating_wog", raw: "1000", quote: "Rated 1000 WOG" },
        { key: "nominal_size", raw: '1/2"', quote: 'Apollo 77C-143-01 1/2" Stainless Ball Valve' },
        { key: "port_configuration", raw: "Full Port", quote: "Full port" },
        { key: "end_connection", raw: "NPT", quote: "NPT threads" },
        { key: "handle_type", raw: "Lever", quote: "Lever handle" },
        { key: "temperature_max", raw: "450F", quote: "Temperature to 450F" },
        { key: "country_of_origin", raw: "USA", quote: "Country of origin: USA" },
        { key: "body_construction", raw: "3 Piece", quote: "3 Piece" },
      ],
    },
    {
      id: "apollo-mkt",
      kind: "marketplace",
      title: "Third-party marketplace listing",
      locator: "seller-supplied attributes",
      url: "https://marketplace.example/item/8827341",
      retrievedAt: "2026-08-14T09:12:21Z",
      excerpt: `Apollo Ball Valve 1/2 inch 3 Piece

Brass body construction with chrome plated ball. Industrial grade.
Max pressure 600 PSI. Lead free and safe for drinking water.
Handle: Tee handle. Ships worldwide.`,
      claims: [
        { key: "body_material", raw: "Brass", quote: "Brass body construction" },
        { key: "ball_material", raw: "Chrome Plated Brass", quote: "chrome plated ball" },
        { key: "pressure_rating_wog", raw: "600 PSI", quote: "Max pressure 600 PSI" },
        { key: "lead_free", raw: "Yes", quote: "Lead free and safe for drinking water" },
        { key: "handle_type", raw: "Tee handle", quote: "Handle: Tee handle" },
      ],
    },
  ],
};

/* ================================================================== *
 * 2. Merit Brass 3212-004 - 1/2 x 4 black steel nipple
 * ================================================================== */

const nipple: CorpusEntry = {
  raw: {
    id: "sku-merit-3212-004",
    mpn: "3212-004",
    brand: "Merit Brass",
    description: "NPL 1/2X4 BLK SCH40 TBE",
    supplierCategory: "FITTINGS",
    listPrice: 4.86,
    uom: "EA",
  },
  expectedClass: "PVF-FIT-NIPPLE",
  sources: [
    {
      id: "merit-ds",
      kind: "manufacturer_datasheet",
      title: "Merit Brass - Black Steel Pipe Nipples, Schedule 40",
      locator: "p.7 - Table 3 - row 3212-004",
      url: "https://meritbrass.example/docs/steel-nipples.pdf",
      retrievedAt: "2026-08-14T10:02:00Z",
      excerpt: `BLACK STEEL PIPE NIPPLES - SCHEDULE 40

Continuous weld carbon steel pipe, cut and threaded to length.
Manufactured to ASTM A733. Pipe conforms to ASTM A53 Grade A.
Threads per ASME B1.20.1 (NPT), threaded both ends.

Standard finish is mill black. Working pressure 300 PSI WOG at
ambient. Maximum service temperature 750 F.

TABLE 3 - 1/2 IN. NPS SCHEDULE 40 NIPPLES
  Part No.     Length    O.D.      Wall      Weight
  3212-002     2 in      0.840     0.109     0.16 lb
  3212-003     3 in      0.840     0.109     0.24 lb
  3212-004     4 in      0.840     0.109     0.32 lb
  3212-006     6 in      0.840     0.109     0.48 lb

Domestic product. Melted and manufactured in the United States,
compliant with Buy American and AIS requirements.`,
      claims: [
        { key: "nipple_material", raw: "Black Steel", quote: "BLACK STEEL PIPE NIPPLES" },
        { key: "schedule", raw: "Schedule 40", quote: "BLACK STEEL PIPE NIPPLES - SCHEDULE 40" },
        { key: "manufacturing_process", raw: "Welded", quote: "Continuous weld carbon steel pipe" },
        { key: "astm_spec", raw: "ASTM A733 / ASTM A53 Grade A", quote: "Manufactured to ASTM A733. Pipe conforms to ASTM A53 Grade A." },
        { key: "thread_type", raw: "NPT", quote: "Threads per ASME B1.20.1 (NPT)" },
        { key: "thread_configuration", raw: "Threaded Both Ends", quote: "threaded both ends" },
        { key: "pressure_rating_wog", raw: "300 PSI", quote: "Working pressure 300 PSI WOG at" },
        { key: "temperature_max", raw: "750 F", quote: "Maximum service temperature 750 F" },
        { key: "nominal_size", raw: "1/2 in", quote: "TABLE 3 - 1/2 IN. NPS SCHEDULE 40 NIPPLES" },
        { key: "overall_length", raw: "4 in", quote: "3212-004     4 in      0.840     0.109     0.32 lb" },
        { key: "outside_diameter", raw: "0.840", quote: "3212-004     4 in      0.840     0.109     0.32 lb" },
        { key: "wall_thickness", raw: "0.109", quote: "3212-004     4 in      0.840     0.109     0.32 lb" },
        { key: "weight", raw: "0.32", quote: "3212-004     4 in      0.840     0.109     0.32 lb" },
        { key: "domestic_origin", raw: "Yes", quote: "compliant with Buy American and AIS requirements" },
        { key: "country_of_origin", raw: "United States", quote: "Melted and manufactured in the United States" },
      ],
    },
    {
      id: "merit-web",
      kind: "manufacturer_web",
      title: "Merit Brass - 3212-004 detail",
      locator: "specification panel",
      url: "https://meritbrass.example/p/3212-004",
      retrievedAt: "2026-08-14T10:02:06Z",
      excerpt: `3212-004 - 1/2 in. x 4 in. Black Steel Nipple, Schedule 40, TBE

Attributes
  NPS: 1/2 in.
  Length: 4 in.
  Schedule: SCH 40
  Material: Black Steel
  Ends: Threaded Both Ends (NPT)
  Process: Welded
  Origin: Domestic

Not certified lead free. Not for potable water service.`,
      claims: [
        { key: "nominal_size", raw: "1/2 in.", quote: "NPS: 1/2 in." },
        { key: "overall_length", raw: "4 in.", quote: "Length: 4 in." },
        { key: "schedule", raw: "SCH 40", quote: "Schedule: SCH 40" },
        { key: "nipple_material", raw: "Black Steel", quote: "Material: Black Steel" },
        { key: "thread_configuration", raw: "TBE", quote: "Ends: Threaded Both Ends (NPT)" },
        { key: "manufacturing_process", raw: "Welded", quote: "Process: Welded" },
        { key: "domestic_origin", raw: "Yes", quote: "Origin: Domestic" },
        { key: "lead_free", raw: "No", quote: "Not certified lead free" },
      ],
    },
    {
      id: "merit-cat",
      kind: "catalog_pdf",
      title: "Wholesale PVF Catalog - Steel Nipples",
      locator: "p.88 - metric equivalents",
      url: "https://catalog.example/pvf-2026.pdf#page=88",
      retrievedAt: "2026-08-14T10:02:11Z",
      excerpt: `STEEL NIPPLES - METRIC EQUIVALENT TABLE

  Cat No.     NPS       Length      Wall       Mass
  3212-004    DN 15     101.6 mm    2.77 mm    145 g

  Pressure rating 20.7 bar WOG. Finish: mill black.`,
      claims: [
        { key: "nominal_size", raw: "DN 15", quote: "3212-004    DN 15" },
        { key: "overall_length", raw: "101.6 mm", quote: "101.6 mm" },
        { key: "wall_thickness", raw: "2.77 mm", quote: "2.77 mm" },
        { key: "pressure_rating_wog", raw: "20.7 bar", quote: "Pressure rating 20.7 bar WOG" },
      ],
    },
    {
      id: "merit-dist",
      kind: "distributor_listing",
      title: "Plumbing supply - 1/2 x 4 black nipple",
      locator: "listing body",
      url: "https://plumbingsupply.example/p/half-by-four-black-nipple",
      retrievedAt: "2026-08-14T10:02:18Z",
      excerpt: `1/2" x 4" Black Iron Nipple

Standard schedule 40 black iron pipe nipple, threaded both ends.
Great for gas lines, air lines and industrial piping. Seamless
construction. 150 PSI rated.`,
      claims: [
        { key: "nipple_material", raw: "Black Iron", quote: "Black Iron Nipple" },
        { key: "schedule", raw: "schedule 40", quote: "Standard schedule 40 black iron pipe nipple" },
        { key: "thread_configuration", raw: "threaded both ends", quote: "threaded both ends" },
        { key: "manufacturing_process", raw: "Seamless", quote: "Seamless" },
        { key: "pressure_rating_wog", raw: "150 PSI", quote: "150 PSI rated" },
      ],
    },
  ],
};

/* ================================================================== *
 * 3. Bray 31-1200 - 4" lug butterfly valve
 * ================================================================== */

const butterfly: CorpusEntry = {
  raw: {
    id: "sku-bray-31-1200",
    mpn: "31-1200-11300-536",
    brand: "Bray",
    description: "BFLY VLV 4IN LUG DI EPDM GEAR OP",
    supplierCategory: "VALVES & ACTUATORS",
    listPrice: 612.4,
    uom: "EA",
  },
  expectedClass: "PVF-VLV-BFLY",
  sources: [
    {
      id: "bray-ds",
      kind: "manufacturer_datasheet",
      title: "Bray Series 31 Resilient Seated Butterfly Valve",
      locator: "p.4 - selection table - 4 in. lug",
      url: "https://bray.example/docs/series-31.pdf",
      retrievedAt: "2026-08-14T11:20:00Z",
      excerpt: `BRAY SERIES 31 - RESILIENT SEATED BUTTERFLY VALVE
Lug body style, bubble tight bidirectional shutoff.

BODY
  Ductile iron ASTM A536 65-45-12, fusion bonded epoxy coated.
  Lug body drilled and tapped to ASME B16.1 Class 125 and
  ASME B16.5 Class 150 flange patterns.

TRIM
  Disc ......... Nickel plated ductile iron
  Seat ......... EPDM, cartridge style, field replaceable
  Stem ......... 416 stainless steel, one piece through shaft

RATINGS
  200 PSI bidirectional dead end service at 4 in. and below.
  Temperature range -20 F to 250 F with EPDM seat.

DIMENSIONS - 4 IN. LUG
  Face to face .... 2.06 in per MSS SP-67
  Weight .......... 24.5 lb with gear operator

OPERATOR
  Gear operated with handwheel and position indicator, 2 in. ISO
  5211 mounting pad.

Standards: MSS SP-67, API 609 Category A. Manufactured in Mexico.`,
      claims: [
        { key: "body_style", raw: "Lug", quote: "Lug body style, bubble tight bidirectional shutoff" },
        { key: "body_material", raw: "Ductile iron ASTM A536", quote: "Ductile iron ASTM A536 65-45-12" },
        { key: "flange_standard", raw: "ASME B16.1 Class 125, ASME B16.5 Class 150", quote: "ASME B16.1 Class 125 and\n  ASME B16.5 Class 150 flange patterns" },
        { key: "disc_material", raw: "Nickel plated ductile iron", quote: "Disc ......... Nickel plated ductile iron" },
        { key: "seat_material", raw: "EPDM", quote: "Seat ......... EPDM, cartridge style, field replaceable" },
        { key: "stem_material", raw: "416 stainless steel", quote: "Stem ......... 416 stainless steel, one piece through shaft" },
        { key: "pressure_rating_wog", raw: "200 PSI", quote: "200 PSI bidirectional dead end service" },
        { key: "temperature_max", raw: "250 F", quote: "-20 F to 250 F with EPDM seat" },
        { key: "temperature_min", raw: "-20 F", quote: "-20 F to 250 F with EPDM seat" },
        { key: "face_to_face", raw: "2.06 in", quote: "Face to face .... 2.06 in per MSS SP-67" },
        { key: "weight", raw: "24.5", quote: "Weight .......... 24.5 lb with gear operator" },
        { key: "handle_type", raw: "Gear operated", quote: "Gear operated with handwheel and position indicator" },
        { key: "approvals", raw: "MSS SP-67, API 609 Category A", quote: "Standards: MSS SP-67, API 609 Category A" },
        { key: "astm_spec", raw: "ASTM A536 65-45-12", quote: "ASTM A536 65-45-12" },
        { key: "country_of_origin", raw: "Mexico", quote: "Manufactured in Mexico" },
        { key: "nominal_size", raw: "4 in", quote: "DIMENSIONS - 4 IN. LUG" },
      ],
    },
    {
      id: "bray-web",
      kind: "manufacturer_web",
      title: "Bray - configurator output for 31-1200-11300-536",
      locator: "configured item summary",
      url: "https://bray.example/config/31-1200-11300-536",
      retrievedAt: "2026-08-14T11:20:07Z",
      excerpt: `Configured item 31-1200-11300-536

  Series ......... 31 Resilient Seated
  Size ........... 4 in.
  Body ........... Lug, ductile iron
  Disc ........... Nickel plated ductile iron
  Seat ........... EPDM
  Stem ........... 416 SS
  Operator ....... Gear operator with handwheel
  Rating ......... 200 psi
  Temperature .... 250 F max`,
      claims: [
        { key: "nominal_size", raw: "4 in.", quote: "Size ........... 4 in." },
        { key: "body_style", raw: "Lug", quote: "Body ........... Lug, ductile iron" },
        { key: "body_material", raw: "ductile iron", quote: "Body ........... Lug, ductile iron" },
        { key: "disc_material", raw: "Nickel plated ductile iron", quote: "Disc ........... Nickel plated ductile iron" },
        { key: "seat_material", raw: "EPDM", quote: "Seat ........... EPDM" },
        { key: "stem_material", raw: "416 SS", quote: "Stem ........... 416 SS" },
        { key: "handle_type", raw: "Gear operator", quote: "Operator ....... Gear operator with handwheel" },
        { key: "pressure_rating_wog", raw: "200 psi", quote: "Rating ......... 200 psi" },
        { key: "temperature_max", raw: "250 F", quote: "Temperature .... 250 F max" },
      ],
    },
    {
      id: "bray-dist",
      kind: "distributor_listing",
      title: "Industrial distributor - Bray 4in butterfly valve",
      locator: "listing body",
      url: "https://industrialdist.example/p/bray-31-4in-lug",
      retrievedAt: "2026-08-14T11:20:13Z",
      excerpt: `Bray Series 31 4" Butterfly Valve - Wafer Style

Ductile iron body butterfly valve with EPDM seat and gear operator.
Rated to 150 PSI. Suitable for HVAC and water service. Nickel plated
disc. Handles temperatures up to 250F.`,
      claims: [
        { key: "body_style", raw: "Wafer", quote: "Wafer Style" },
        { key: "pressure_rating_wog", raw: "150 PSI", quote: "Rated to 150 PSI" },
        { key: "seat_material", raw: "EPDM", quote: "EPDM seat" },
        { key: "handle_type", raw: "gear operator", quote: "gear operator" },
        { key: "temperature_max", raw: "250F", quote: "temperatures up to 250F" },
      ],
    },
    {
      id: "bray-img",
      kind: "product_image",
      title: "Nameplate photograph - vision extraction",
      locator: "nameplate crop, 1240x820",
      url: "https://cdn.example/img/bray-31-nameplate.jpg",
      retrievedAt: "2026-08-14T11:20:19Z",
      excerpt: `[vision transcription of stamped nameplate]

BRAY SERIES 31
SIZE 4 IN   FIG 31-1200
BODY DI  DISC NI-DI  SEAT EPDM
200 PSI CWP
MADE IN MEXICO`,
      claims: [
        { key: "nominal_size", raw: "4 IN", quote: "SIZE 4 IN   FIG 31-1200" },
        { key: "pressure_rating_wog", raw: "200 PSI", quote: "200 PSI CWP" },
        { key: "country_of_origin", raw: "Mexico", quote: "MADE IN MEXICO" },
        { key: "seat_material", raw: "EPDM", quote: "SEAT EPDM" },
      ],
    },
  ],
};

/* ================================================================== *
 * 4. Capitol WN-150-2-S40 - 2" Class 150 weld neck flange
 * ================================================================== */

const flange: CorpusEntry = {
  raw: {
    id: "sku-capitol-wn-150-2",
    mpn: "WN-150-2-S40",
    brand: "Capitol Manufacturing",
    description: "FLG 2 150# WN RF A105 S40",
    supplierCategory: "FLANGES",
    listPrice: 38.75,
    uom: "EA",
  },
  expectedClass: "PVF-FLG-PIPE",
  sources: [
    {
      id: "capitol-ds",
      kind: "manufacturer_datasheet",
      title: "Capitol Manufacturing - Forged Steel Flanges ASME B16.5",
      locator: "p.11 - Class 150 weld neck - 2 in row",
      url: "https://capitolmfg.example/docs/b165-flanges.pdf",
      retrievedAt: "2026-08-14T12:41:00Z",
      excerpt: `FORGED CARBON STEEL FLANGES TO ASME B16.5
CLASS 150 - WELD NECK - RAISED FACE

Material: ASTM A105 forged carbon steel, normalized.
Face finish: 125-250 AARH serrated concentric.
Maximum temperature 1000 F per ASME B16.5 Table 2-1.1.

CLASS 150 WELD NECK DIMENSIONS
  NPS    O.D.     Thickness   Bolt Circle   Holes   Hole Dia   Weight
  1-1/2  5.00     0.69        3.88          4       0.62       3.0 lb
  2      6.00     0.75        4.75          4       0.75       5.0 lb
  3      7.50     0.94        6.00          4       0.75       9.0 lb
  4      9.00     0.94        7.50          8       0.75      15.0 lb

Bore supplied to match Schedule 40 pipe unless otherwise specified.
Product of India.`,
      claims: [
        { key: "flange_material", raw: "ASTM A105", quote: "Material: ASTM A105 forged carbon steel, normalized" },
        { key: "pressure_class", raw: "Class 150", quote: "CLASS 150 - WELD NECK - RAISED FACE" },
        { key: "flange_type", raw: "Weld Neck", quote: "CLASS 150 - WELD NECK - RAISED FACE" },
        { key: "face_type", raw: "Raised Face", quote: "CLASS 150 - WELD NECK - RAISED FACE" },
        { key: "surface_finish", raw: "125-250 AARH serrated concentric", quote: "Face finish: 125-250 AARH serrated concentric" },
        { key: "temperature_max", raw: "1000 F", quote: "Maximum temperature 1000 F per ASME B16.5" },
        { key: "standard", raw: "ASME B16.5", quote: "FORGED CARBON STEEL FLANGES TO ASME B16.5" },
        { key: "nominal_size", raw: "2", quote: "  2      6.00     0.75        4.75          4       0.75       5.0 lb" },
        { key: "outside_diameter", raw: "6.00", quote: "  2      6.00     0.75        4.75          4       0.75       5.0 lb" },
        { key: "flange_thickness", raw: "0.75", quote: "  2      6.00     0.75        4.75          4       0.75       5.0 lb" },
        { key: "bolt_circle_diameter", raw: "4.75", quote: "  2      6.00     0.75        4.75          4       0.75       5.0 lb" },
        { key: "bolt_hole_count", raw: "4", quote: "  2      6.00     0.75        4.75          4       0.75       5.0 lb" },
        { key: "bolt_hole_diameter", raw: "0.75", quote: "  2      6.00     0.75        4.75          4       0.75       5.0 lb" },
        { key: "weight", raw: "5.0", quote: "  2      6.00     0.75        4.75          4       0.75       5.0 lb" },
        { key: "bore_schedule", raw: "SCH 40", quote: "Bore supplied to match Schedule 40 pipe" },
        { key: "astm_spec", raw: "ASTM A105", quote: "ASTM A105" },
        { key: "country_of_origin", raw: "India", quote: "Product of India" },
      ],
    },
    {
      id: "capitol-web",
      kind: "manufacturer_web",
      title: "Capitol - WN-150-2-S40 item detail",
      locator: "attribute grid",
      url: "https://capitolmfg.example/item/WN-150-2-S40",
      retrievedAt: "2026-08-14T12:41:05Z",
      excerpt: `WN-150-2-S40 - 2 in. Class 150 Weld Neck Flange, Raised Face

  Size .............. 2 in.
  Class ............. 150
  Type .............. Weld Neck
  Face .............. Raised Face
  Grade ............. A105
  Bore .............. Schedule 40
  Standard .......... ASME B16.5
  O.D. .............. 6 in.
  Bolt circle ....... 4-3/4 in.
  Bolt holes ........ 4 at 3/4 in.`,
      claims: [
        { key: "nominal_size", raw: "2 in.", quote: "Size .............. 2 in." },
        { key: "pressure_class", raw: "150", quote: "Class ............. 150" },
        { key: "flange_type", raw: "Weld Neck", quote: "Type .............. Weld Neck" },
        { key: "face_type", raw: "Raised Face", quote: "Face .............. Raised Face" },
        { key: "flange_material", raw: "A105", quote: "Grade ............. A105" },
        { key: "bore_schedule", raw: "Schedule 40", quote: "Bore .............. Schedule 40" },
        { key: "standard", raw: "ASME B16.5", quote: "Standard .......... ASME B16.5" },
        { key: "outside_diameter", raw: "6 in.", quote: "O.D. .............. 6 in." },
        { key: "bolt_circle_diameter", raw: "4-3/4 in.", quote: "Bolt circle ....... 4-3/4 in." },
        { key: "bolt_hole_count", raw: "4", quote: "Bolt holes ........ 4 at 3/4 in." },
        { key: "bolt_hole_diameter", raw: "3/4 in.", quote: "Bolt holes ........ 4 at 3/4 in." },
      ],
    },
    {
      id: "capitol-dist",
      kind: "distributor_listing",
      title: "Pipe supply - 2 inch 150# weld neck flange",
      locator: "listing body",
      url: "https://pipesupply.example/p/2in-150-wn-rf-a105",
      retrievedAt: "2026-08-14T12:41:12Z",
      excerpt: `2" 150# Weld Neck Flange, Raised Face, A105 Carbon Steel

Forged carbon steel flange manufactured to ANSI B16.5 standards.
Schedule 40 bore. 8 bolt holes on a 4-3/4" bolt circle.
Domestic and import available. Weight approximately 5 lbs.`,
      claims: [
        { key: "bolt_hole_count", raw: "8", quote: "8 bolt holes on a 4-3/4\" bolt circle" },
        { key: "bolt_circle_diameter", raw: '4-3/4"', quote: "8 bolt holes on a 4-3/4\" bolt circle" },
        { key: "bore_schedule", raw: "Schedule 40", quote: "Schedule 40 bore" },
        { key: "flange_material", raw: "A105", quote: "A105 Carbon Steel" },
        { key: "weight", raw: "5", quote: "Weight approximately 5 lbs" },
      ],
    },
  ],
};

/* ================================================================== *
 * 5. NIBCO T-585-70-66-LF - 3/4" lead free bronze ball valve
 * ================================================================== */

const nibco: CorpusEntry = {
  raw: {
    id: "sku-nibco-t585-70-66-lf",
    mpn: "T-585-70-66-LF",
    brand: "NIBCO",
    description: "VLV BALL 3/4 LF TH 600WOG",
    supplierCategory: "VALVES",
    listPrice: 62.15,
    uom: "EA",
  },
  expectedClass: "PVF-VLV-BALL",
  sources: [
    {
      id: "nibco-ds",
      kind: "manufacturer_datasheet",
      title: "NIBCO T-585-70-66-LF Lead Free Bronze Ball Valve",
      locator: "p.1 - specification block",
      url: "https://nibco.example/docs/T-585-70-66-LF.pdf",
      retrievedAt: "2026-08-14T13:05:00Z",
      excerpt: `NIBCO T-585-70-66-LF
TWO PIECE LEAD FREE BRONZE BALL VALVE, FULL PORT

Conforms to MSS SP-110. Certified to NSF/ANSI 61-G and
NSF/ANSI 372 for potable water service.

PRESSURE / TEMPERATURE
  600 PSI/CWP non-shock cold working pressure.
  150 PSI saturated steam.
  Temperature range 0 F to 366 F.

MATERIAL LIST
  Body ........ Lead free silicon bronze, ASTM B584 UNS C87850
  Ball ........ Chrome plated brass
  Stem ........ Lead free bronze, blowout proof
  Seat ........ Reinforced PTFE
  Handle ...... Steel lever with vinyl grip

CONNECTIONS
  Female NPT threaded per ASME B1.20.1, both ends.
  Nominal size 3/4 in.

APPROVALS
  UL listed, FM approved, IAPMO certified, NSF/ANSI 61-G, NSF/ANSI 372.
  Made in the U.S.A.`,
      claims: [
        { key: "body_construction", raw: "Two Piece", quote: "TWO PIECE LEAD FREE BRONZE BALL VALVE, FULL PORT" },
        { key: "port_configuration", raw: "Full Port", quote: "TWO PIECE LEAD FREE BRONZE BALL VALVE, FULL PORT" },
        { key: "lead_free", raw: "Yes", quote: "NSF/ANSI 372 for potable water service" },
        { key: "pressure_rating_wog", raw: "600 PSI", quote: "600 PSI/CWP non-shock cold working pressure" },
        { key: "pressure_rating_steam", raw: "150 PSI", quote: "150 PSI saturated steam" },
        { key: "temperature_max", raw: "366 F", quote: "Temperature range 0 F to 366 F" },
        { key: "temperature_min", raw: "0 F", quote: "Temperature range 0 F to 366 F" },
        { key: "body_material", raw: "Bronze", quote: "Body ........ Lead free silicon bronze, ASTM B584 UNS C87850" },
        { key: "ball_material", raw: "Chrome plated brass", quote: "Ball ........ Chrome plated brass" },
        { key: "stem_material", raw: "Lead free bronze", quote: "Stem ........ Lead free bronze, blowout proof" },
        { key: "stem_design", raw: "Blowout Proof", quote: "blowout proof" },
        { key: "seat_material", raw: "Reinforced PTFE", quote: "Seat ........ Reinforced PTFE" },
        { key: "handle_type", raw: "Lever", quote: "Handle ...... Steel lever with vinyl grip" },
        { key: "end_connection", raw: "NPT", quote: "Female NPT threaded per ASME B1.20.1, both ends" },
        { key: "nominal_size", raw: "3/4 in.", quote: "Nominal size 3/4 in." },
        { key: "approvals", raw: "UL, FM, IAPMO, NSF/ANSI 61-G, NSF/ANSI 372", quote: "UL listed, FM approved, IAPMO certified, NSF/ANSI 61-G, NSF/ANSI 372" },
        { key: "astm_spec", raw: "ASTM B584 UNS C87850", quote: "ASTM B584 UNS C87850" },
        { key: "country_of_origin", raw: "United States", quote: "Made in the U.S.A." },
      ],
    },
    {
      id: "nibco-web",
      kind: "manufacturer_web",
      title: "NIBCO product page - T-585-70-66-LF",
      locator: "specs accordion",
      url: "https://nibco.example/p/T-585-70-66-LF",
      retrievedAt: "2026-08-14T13:05:06Z",
      excerpt: `T-585-70-66-LF | 3/4 in. Lead Free Bronze Ball Valve

  Size: 3/4 in.
  Body material: Bronze
  Port: Full Port
  End connection: NPT Threaded
  Pressure: 600 WOG
  Seat: RPTFE
  Handle: Lever, non-locking
  Media: Potable water, hydronic heating, compressed air`,
      claims: [
        { key: "nominal_size", raw: "3/4 in.", quote: "Size: 3/4 in." },
        { key: "body_material", raw: "Bronze", quote: "Body material: Bronze" },
        { key: "port_configuration", raw: "Full Port", quote: "Port: Full Port" },
        { key: "end_connection", raw: "NPT Threaded", quote: "End connection: NPT Threaded" },
        { key: "pressure_rating_wog", raw: "600", quote: "Pressure: 600 WOG" },
        { key: "seat_material", raw: "RPTFE", quote: "Seat: RPTFE" },
        { key: "handle_type", raw: "Lever", quote: "Handle: Lever, non-locking" },
        { key: "locking_handle", raw: "No", quote: "Handle: Lever, non-locking" },
        { key: "media", raw: "Potable water, hydronic heating, compressed air", quote: "Media: Potable water, hydronic heating, compressed air" },
      ],
    },
    {
      id: "nibco-dist",
      kind: "distributor_listing",
      title: "Mechanical supply - NIBCO T-585 lead free",
      locator: "listing body",
      url: "https://mechsupply.example/p/nibco-t585-70-66-lf",
      retrievedAt: "2026-08-14T13:05:13Z",
      excerpt: `NIBCO T-585-70-66-LF 3/4" Lead Free Ball Valve

Two piece bronze body, full port, threaded NPT ends.
600 PSI WOG / 150 PSI WSP. UL/FM approved. Lead free
certified for drinking water. Weight 1.4 lbs.
Made in USA.`,
        claims: [
        { key: "body_construction", raw: "Two piece", quote: "Two piece bronze body" },
        { key: "pressure_rating_wog", raw: "600 PSI", quote: "600 PSI WOG / 150 PSI WSP" },
        { key: "lead_free", raw: "Yes", quote: "Lead free\ncertified for drinking water" },
        { key: "weight", raw: "1.4", quote: "Weight 1.4 lbs" },
        { key: "approvals", raw: "UL/FM approved", quote: "UL/FM approved" },
      ],
    },
    {
      id: "nibco-mkt",
      kind: "marketplace",
      title: "Marketplace reseller listing",
      locator: "seller attributes",
      url: "https://marketplace.example/item/5512099",
      retrievedAt: "2026-08-14T13:05:20Z",
      excerpt: `NIBCO 3/4 Ball Valve Lead Free

Stainless steel construction. 1000 PSI maximum working pressure.
Gear operated for easy turning. Suitable for steam to 600F.`,
      claims: [
        { key: "body_material", raw: "Stainless Steel 304", quote: "Stainless steel construction" },
        { key: "pressure_rating_wog", raw: "1000 PSI", quote: "1000 PSI maximum working pressure" },
        { key: "handle_type", raw: "Gear Operated", quote: "Gear operated for easy turning" },
        { key: "temperature_max", raw: "600F", quote: "Suitable for steam to 600F" },
      ],
    },
  ],
};

export const CORPUS: CorpusEntry[] = [apollo, nipple, butterfly, flange, nibco];

export const CORPUS_BY_ID = new Map(CORPUS.map((c) => [c.raw.id, c]));

export function findCorpusEntry(
  mpn: string,
  brand: string,
): CorpusEntry | undefined {
  const m = mpn.trim().toLowerCase();
  const b = brand.trim().toLowerCase();
  return CATALOG.find(
    (c) =>
      c.raw.mpn.toLowerCase() === m ||
      (c.raw.brand.toLowerCase() === b && c.raw.mpn.toLowerCase().includes(m)),
  );
}

/* ------------------------------------------------------------------ *
 * Variant expansion.
 *
 * Siblings named by a parent's dimension table become first-class SKUs.
 * They inherit the parent's evidence pool, minus the row-dependent
 * claims, and gain the claims their own table row carries.
 * ------------------------------------------------------------------ */

function deriveVariant(
  parent: CorpusEntry,
  spec: VariantSpec,
  row: VariantRow,
): CorpusEntry {
  const varying = new Set(spec.variantKeys);

  const sources = parent.sources.map((source) => {
    // Row-dependent attributes come from the table alone; a sibling must
    // not inherit "Size: 1/2 in." from the parent's marketing page.
    const kept = source.claims.filter((c) => !varying.has(c.key));
    return {
      ...source,
      claims:
        source.id === spec.tableSourceId ? [...kept, ...row.claims] : kept,
    };
  });

  return {
    raw: {
      id: `sku-${row.mpn.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      mpn: row.mpn,
      brand: parent.raw.brand,
      description: row.description,
      supplierCategory: parent.raw.supplierCategory,
      listPrice: row.listPrice,
      uom: parent.raw.uom,
    },
    expectedClass: parent.expectedClass,
    sources,
  };
}

/** Every SKU the engine can answer for: the seeds plus their siblings. */
export const CATALOG: CorpusEntry[] = (() => {
  const out = [...CORPUS];
  for (const spec of VARIANTS) {
    const parent = CORPUS_BY_ID.get(spec.parentId);
    if (!parent) continue;
    for (const row of spec.rows) out.push(deriveVariant(parent, spec, row));
  }
  return out;
})();

export const CATALOG_BY_MPN = new Map(
  CATALOG.map((c) => [c.raw.mpn.toLowerCase(), c]),
);

/** Ids of the hand-authored seeds, as opposed to table-derived siblings. */
export const SEED_IDS = new Set(CORPUS.map((c) => c.raw.id));

/**
 * Every claim quote must be a literal substring of its excerpt, or the
 * provenance highlighting is a lie. Checked at request time so the
 * number shown in the UI is measured, not asserted.
 */
export function verifyProvenance() {
  let total = 0;
  let anchored = 0;
  for (const entry of CATALOG) {
    for (const source of entry.sources) {
      for (const claim of source.claims) {
        total++;
        if (source.excerpt.includes(claim.quote)) anchored++;
      }
    }
  }
  return { total, anchored };
}
