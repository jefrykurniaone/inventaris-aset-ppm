import type { SeedCatalogItem } from "@/lib/seed-asset-mix";

/** Twelve laboratory items (issue #16). Prices are plausible Indonesian
 * market prices for this equipment, whole rupiah, for the dashboard's total
 * value figures — not a quote from any real vendor. */
export const CATALOG_LAB: readonly SeedCatalogItem[] = [
  {
    categoryCode: "LAB",
    name: "Osiloskop Digital",
    brand: "Tektronix",
    model: "TBS2104",
    basePriceIdr: 45_000_000,
  },
  {
    categoryCode: "LAB",
    name: "Spectrum Analyzer",
    brand: "Keysight",
    model: "N9010B",
    basePriceIdr: 185_000_000,
  },
  {
    categoryCode: "LAB",
    name: "Soldering Station",
    brand: "Hakko",
    model: "FX-888D",
    basePriceIdr: 2_500_000,
  },
  {
    categoryCode: "LAB",
    name: "Multimeter Digital",
    brand: "Fluke",
    model: "87V",
    basePriceIdr: 8_500_000,
  },
  {
    categoryCode: "LAB",
    name: "Printer 3D",
    brand: "Prusa",
    model: "i3 MK3S+",
    basePriceIdr: 15_000_000,
  },
  {
    categoryCode: "LAB",
    name: "Mikroskop Digital",
    brand: "Olympus",
    model: "CX23",
    basePriceIdr: 35_000_000,
  },
  {
    categoryCode: "LAB",
    name: "Power Supply DC",
    brand: "GW Instek",
    model: "GPS-3303",
    basePriceIdr: 6_000_000,
  },
  {
    categoryCode: "LAB",
    name: "Function Generator",
    brand: "Rigol",
    model: "DG1022Z",
    basePriceIdr: 12_000_000,
  },
  {
    categoryCode: "LAB",
    name: "Logic Analyzer",
    brand: "Saleae",
    model: "Logic Pro 16",
    basePriceIdr: 18_000_000,
  },
  {
    categoryCode: "LAB",
    name: "Mesin PCR",
    brand: "Bio-Rad",
    model: "T100",
    basePriceIdr: 95_000_000,
  },
  {
    categoryCode: "LAB",
    name: "Timbangan Analitik",
    brand: "Ohaus",
    model: "PA214",
    basePriceIdr: 22_000_000,
  },
  {
    categoryCode: "LAB",
    name: "Centrifuge Laboratorium",
    brand: "Hettich",
    model: "EBA 200",
    basePriceIdr: 28_000_000,
  },
];
