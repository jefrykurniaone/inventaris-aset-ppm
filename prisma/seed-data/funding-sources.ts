/**
 * Four funding sources reflecting how a research and community-service
 * directorate is actually funded (issue #16): competitive research grants,
 * community-service grants, the directorate's own budget, and industry
 * collaboration. Keyed on `name`, which is `FundingSource`'s unique column.
 */
export interface SeedFundingSourceSpec {
  readonly name: string;
  readonly notes: string | null;
}

export const SEED_FUNDING_SOURCES: readonly SeedFundingSourceSpec[] = [
  {
    name: "Hibah Penelitian Kompetitif Nasional",
    notes: "Kemdikbudristek / BRIN",
  },
  {
    name: "Hibah Pengabdian kepada Masyarakat",
    notes: "Program tahunan Direktorat PPM",
  },
  {
    name: "Anggaran Internal Direktorat PPM",
    notes: null,
  },
  {
    name: "Kerja Sama Riset Industri",
    notes: "Mitra industri dan alumni",
  },
];
