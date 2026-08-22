import type { SeedCatalogItem } from "@/lib/seed-asset-mix";

/** Twelve miscellaneous items (issue #16). A few carry no brand or model —
 * plenty of real inventory rows don't, and `assetSchema` treats both as
 * optional. */
export const CATALOG_OTH: readonly SeedCatalogItem[] = [
  {
    categoryCode: "OTH",
    name: "Alat Pemadam Kebakaran (APAR) 6kg",
    brand: "Yamato",
    model: "6kg ABC",
    basePriceIdr: 850_000,
  },
  {
    categoryCode: "OTH",
    name: "Lemari P3K Lengkap",
    brand: "Onemed",
    model: "P3K-01",
    basePriceIdr: 1_500_000,
  },
  {
    categoryCode: "OTH",
    name: "Kamera CCTV",
    brand: "Hikvision",
    model: "DS-2CE16",
    basePriceIdr: 1_200_000,
  },
  {
    categoryCode: "OTH",
    name: "Genset",
    brand: "Perkins",
    model: "10 kVA",
    basePriceIdr: 65_000_000,
  },
  {
    categoryCode: "OTH",
    name: "Lemari Peralatan Bengkel",
    brand: "Krisbow",
    model: "LPB-2",
    basePriceIdr: 3_400_000,
  },
  {
    categoryCode: "OTH",
    name: "Sepeda Inventaris Kantor",
    brand: "Polygon",
    model: "Sierra",
    basePriceIdr: 2_800_000,
  },
  {
    categoryCode: "OTH",
    name: "Tiang Bendera Lipat",
    brand: null,
    model: null,
    basePriceIdr: 750_000,
  },
  {
    categoryCode: "OTH",
    name: "Tangga Aluminium",
    brand: "Krisbow",
    model: "7 Step",
    basePriceIdr: 1_100_000,
  },
  {
    categoryCode: "OTH",
    name: "Trolley Barang Serbaguna",
    brand: "Krisbow",
    model: "TR-150",
    basePriceIdr: 950_000,
  },
  {
    categoryCode: "OTH",
    name: "Kotak Saran dan Pengaduan",
    brand: null,
    model: null,
    basePriceIdr: 350_000,
  },
  {
    categoryCode: "OTH",
    name: "Alat Penyemprot Disinfektan",
    brand: "Krisbow",
    model: "Sprayer-16L",
    basePriceIdr: 1_650_000,
  },
  {
    categoryCode: "OTH",
    name: "Rambu Evakuasi Set",
    brand: null,
    model: null,
    basePriceIdr: 500_000,
  },
];
