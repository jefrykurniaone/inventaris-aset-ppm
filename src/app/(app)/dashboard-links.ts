import { ASSETS_PATH } from "@/lib/paths";

import type { AssetStatus } from "./assets/schemas";

/**
 * The asset-list URL each dashboard card and chart segment links to (PRD
 * FR-9.1, FR-9.2: "clicking a card or chart segment opens the asset list
 * with the corresponding filter applied"). Plain string building rather than
 * `URLSearchParams` — every filter here is a single known key with a value
 * that needs no further escaping beyond what the template literal already
 * gives a UUID, an enum member, or a four-digit year.
 */

function assetsHref(query: string): string {
  return `${ASSETS_PATH}?${query}`;
}

/** The total-assets and total-value cards: no filter distinguishes them from
 * the whole live register, so both open the same unfiltered list. */
export const ALL_ASSETS_HREF = ASSETS_PATH;

export function statusFilterHref(status: AssetStatus): string {
  return assetsHref(`status=${encodeURIComponent(status)}`);
}

export function categoryFilterHref(categoryId: string): string {
  return assetsHref(`categoryId=${encodeURIComponent(categoryId)}`);
}

export function acquisitionYearFilterHref(year: number): string {
  return assetsHref(`acquisitionYear=${encodeURIComponent(String(year))}`);
}

export function attentionFilterHref(): string {
  return assetsHref("attention=1");
}
