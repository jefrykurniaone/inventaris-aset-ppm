/**
 * The five demonstration categories (issue #16). Codes must satisfy
 * `categorySchema` — `/^[A-Z]{2,4}$/`, letters only, never a digit — the same
 * trap `scripts/seed-e2e-master-data.ts` documents having been bitten by
 * once already (issue #70).
 */
export interface SeedCategorySpec {
  readonly code: string;
  readonly name: string;
  readonly nameEn: string;
}

export const SEED_CATEGORIES: readonly SeedCategorySpec[] = [
  {
    code: "LAB",
    name: "Peralatan Laboratorium",
    nameEn: "Laboratory Equipment",
  },
  {
    code: "IT",
    name: "Teknologi Informasi",
    nameEn: "Information Technology",
  },
  { code: "FUR", name: "Furnitur", nameEn: "Furniture" },
  { code: "OFC", name: "Peralatan Kantor", nameEn: "Office Equipment" },
  { code: "OTH", name: "Lain-lain", nameEn: "Other" },
];
