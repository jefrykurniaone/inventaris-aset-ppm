import type { SeedCatalogItem } from "@/lib/seed-asset-mix";

import { CATALOG_FUR } from "./catalog-fur";
import { CATALOG_IT } from "./catalog-it";
import { CATALOG_LAB } from "./catalog-lab";
import { CATALOG_OFC } from "./catalog-ofc";
import { CATALOG_OTH } from "./catalog-oth";

/**
 * The sixty demonstration assets (issue #16), twelve per category, in a
 * fixed order — `src/lib/seed-asset-mix.ts` assigns status, condition,
 * acquisition year, loan role and photo count purely from each item's
 * position in this array, so the order here *is* part of the dataset.
 *
 * Split into one file per category so no single file holds all sixty items,
 * and so a category's equipment list can be skimmed and edited on its own.
 */
export const ASSET_CATALOG: readonly SeedCatalogItem[] = [
  ...CATALOG_LAB,
  ...CATALOG_IT,
  ...CATALOG_FUR,
  ...CATALOG_OFC,
  ...CATALOG_OTH,
];
