/* ------------------------------------------------------------------ *
 * Variant explosion.
 *
 * One industrial datasheet almost never describes one SKU. It describes
 * a family, and the dimension table at the back carries a row per part
 * number. Turning that single document into a fully attributed record
 * for every row is one of the most expensive manual jobs in a
 * distributor's catalogue team.
 *
 * Each row here names the part it produces and the claims that row
 * carries. The quotes are literal substrings of the parent's table, so a
 * derived SKU is exactly as defensible as the one it came from - it
 * cites the same document, at the row that describes it.
 *
 * Attributes that vary by row are taken ONLY from the table. A sibling
 * does not get to inherit "Size: 1/2 in." from the parent's web page,
 * which is why derived variants carry slightly lower corroboration on
 * those attributes. That is honest, not a defect.
 * ------------------------------------------------------------------ */

import type { SourceClaim } from "@/lib/types";

export interface VariantRow {
  mpn: string;
  description: string;
  listPrice?: number;
  claims: SourceClaim[];
}

export interface VariantSpec {
  parentId: string;
  /** The source whose excerpt holds the dimension table. */
  tableSourceId: string;
  /** Attributes that vary row to row and must come from the table alone. */
  variantKeys: string[];
  rows: VariantRow[];
}

export const VARIANTS: VariantSpec[] = [
  {
    parentId: "sku-apollo-77c-143-01",
    tableSourceId: "apollo-ds",
    variantKeys: ["nominal_size", "cv_flow", "weight"],
    rows: [
      {
        mpn: "77C-142-01",
        description: "BALL VLV 3/8 3PC SS FP LKG HDL",
        listPrice: 139.4,
        claims: [
          { key: "nominal_size", raw: "3/8", quote: "77C-142-01     3/8      12.5    0.94 lb" },
          { key: "cv_flow", raw: "12.5", quote: "77C-142-01     3/8      12.5    0.94 lb" },
          { key: "weight", raw: "0.94", quote: "77C-142-01     3/8      12.5    0.94 lb" },
        ],
      },
      {
        mpn: "77C-144-01",
        description: "BALL VLV 3/4 3PC SS FP LKG HDL",
        listPrice: 176.9,
        claims: [
          { key: "nominal_size", raw: "3/4", quote: "77C-144-01     3/4      32.0    1.78 lb" },
          { key: "cv_flow", raw: "32.0", quote: "77C-144-01     3/4      32.0    1.78 lb" },
          { key: "weight", raw: "1.78", quote: "77C-144-01     3/4      32.0    1.78 lb" },
        ],
      },
      {
        mpn: "77C-145-01",
        description: "BALL VLV 1IN 3PC SS FP LKG HDL",
        listPrice: 214.55,
        claims: [
          { key: "nominal_size", raw: "1", quote: "77C-145-01     1        55.0    2.65 lb" },
          { key: "cv_flow", raw: "55.0", quote: "77C-145-01     1        55.0    2.65 lb" },
          { key: "weight", raw: "2.65", quote: "77C-145-01     1        55.0    2.65 lb" },
        ],
      },
    ],
  },

  {
    parentId: "sku-merit-3212-004",
    tableSourceId: "merit-ds",
    variantKeys: ["overall_length", "weight"],
    rows: [
      {
        mpn: "3212-002",
        description: "NPL 1/2X2 BLK SCH40 TBE",
        listPrice: 3.14,
        claims: [
          { key: "overall_length", raw: "2 in", quote: "3212-002     2 in      0.840     0.109     0.16 lb" },
          { key: "weight", raw: "0.16", quote: "3212-002     2 in      0.840     0.109     0.16 lb" },
        ],
      },
      {
        mpn: "3212-003",
        description: "NPL 1/2X3 BLK SCH40 TBE",
        listPrice: 3.92,
        claims: [
          { key: "overall_length", raw: "3 in", quote: "3212-003     3 in      0.840     0.109     0.24 lb" },
          { key: "weight", raw: "0.24", quote: "3212-003     3 in      0.840     0.109     0.24 lb" },
        ],
      },
      {
        mpn: "3212-006",
        description: "NPL 1/2X6 BLK SCH40 TBE",
        listPrice: 6.48,
        claims: [
          { key: "overall_length", raw: "6 in", quote: "3212-006     6 in      0.840     0.109     0.48 lb" },
          { key: "weight", raw: "0.48", quote: "3212-006     6 in      0.840     0.109     0.48 lb" },
        ],
      },
    ],
  },

  {
    parentId: "sku-capitol-wn-150-2",
    tableSourceId: "capitol-ds",
    variantKeys: [
      "nominal_size",
      "outside_diameter",
      "flange_thickness",
      "bolt_circle_diameter",
      "bolt_hole_count",
      "bolt_hole_diameter",
      "weight",
    ],
    rows: [
      {
        mpn: "WN-150-1.5-S40",
        description: "FLG 1-1/2 150# WN RF A105 S40",
        listPrice: 29.4,
        claims: [
          { key: "nominal_size", raw: "1-1/2", quote: "  1-1/2  5.00     0.69        3.88          4       0.62       3.0 lb" },
          { key: "outside_diameter", raw: "5.00", quote: "  1-1/2  5.00     0.69        3.88          4       0.62       3.0 lb" },
          { key: "flange_thickness", raw: "0.69", quote: "  1-1/2  5.00     0.69        3.88          4       0.62       3.0 lb" },
          { key: "bolt_circle_diameter", raw: "3.88", quote: "  1-1/2  5.00     0.69        3.88          4       0.62       3.0 lb" },
          { key: "bolt_hole_count", raw: "4", quote: "  1-1/2  5.00     0.69        3.88          4       0.62       3.0 lb" },
          { key: "bolt_hole_diameter", raw: "0.62", quote: "  1-1/2  5.00     0.69        3.88          4       0.62       3.0 lb" },
          { key: "weight", raw: "3.0", quote: "  1-1/2  5.00     0.69        3.88          4       0.62       3.0 lb" },
        ],
      },
      {
        mpn: "WN-150-3-S40",
        description: "FLG 3 150# WN RF A105 S40",
        listPrice: 52.1,
        claims: [
          { key: "nominal_size", raw: "3", quote: "  3      7.50     0.94        6.00          4       0.75       9.0 lb" },
          { key: "outside_diameter", raw: "7.50", quote: "  3      7.50     0.94        6.00          4       0.75       9.0 lb" },
          { key: "flange_thickness", raw: "0.94", quote: "  3      7.50     0.94        6.00          4       0.75       9.0 lb" },
          { key: "bolt_circle_diameter", raw: "6.00", quote: "  3      7.50     0.94        6.00          4       0.75       9.0 lb" },
          { key: "bolt_hole_count", raw: "4", quote: "  3      7.50     0.94        6.00          4       0.75       9.0 lb" },
          { key: "bolt_hole_diameter", raw: "0.75", quote: "  3      7.50     0.94        6.00          4       0.75       9.0 lb" },
          { key: "weight", raw: "9.0", quote: "  3      7.50     0.94        6.00          4       0.75       9.0 lb" },
        ],
      },
      {
        mpn: "WN-150-4-S40",
        description: "FLG 4 150# WN RF A105 S40",
        listPrice: 71.85,
        claims: [
          { key: "nominal_size", raw: "4", quote: "  4      9.00     0.94        7.50          8       0.75      15.0 lb" },
          { key: "outside_diameter", raw: "9.00", quote: "  4      9.00     0.94        7.50          8       0.75      15.0 lb" },
          { key: "flange_thickness", raw: "0.94", quote: "  4      9.00     0.94        7.50          8       0.75      15.0 lb" },
          { key: "bolt_circle_diameter", raw: "7.50", quote: "  4      9.00     0.94        7.50          8       0.75      15.0 lb" },
          { key: "bolt_hole_count", raw: "8", quote: "  4      9.00     0.94        7.50          8       0.75      15.0 lb" },
          { key: "bolt_hole_diameter", raw: "0.75", quote: "  4      9.00     0.94        7.50          8       0.75      15.0 lb" },
          { key: "weight", raw: "15.0", quote: "  4      9.00     0.94        7.50          8       0.75      15.0 lb" },
        ],
      },
    ],
  },
];
