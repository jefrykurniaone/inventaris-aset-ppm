import {
  DEFAULT_ASSET_LIST_PAGE_SIZE,
  DEFAULT_ASSET_LIST_SORT_DIRECTION,
  DEFAULT_ASSET_LIST_SORT_KEY,
  FIRST_ASSET_LIST_PAGE,
  type AssetListSortDirection,
  type AssetListSortKey,
} from "./asset-list-query";

/**
 * Serialises the asset list's filters, sort and page back into a query
 * string (PRD FR-2.6: "filter state round-trips through the URL"). Every
 * value that already equals its default is omitted, so a plain `/assets`
 * visit with no filter touched stays a plain `/assets` link rather than
 * growing every default into the address bar.
 */
export interface AssetListUrlState {
  readonly q?: string;
  readonly categoryId?: string;
  readonly buildingId?: string;
  readonly roomId?: string;
  readonly status?: string;
  readonly condition?: string;
  readonly acquisitionYear?: number;
  readonly fundingSourceId?: string;
  readonly attention?: boolean;
  readonly sort: AssetListSortKey;
  readonly dir: AssetListSortDirection;
  readonly page: number;
  readonly pageSize: number;
}

const STRING_FIELDS = [
  "q",
  "categoryId",
  "buildingId",
  "roomId",
  "status",
  "condition",
  "fundingSourceId",
] as const;

/** The query string for one asset-list state, with no leading `?`. */
export function buildAssetListSearchParams(
  state: AssetListUrlState,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const field of STRING_FIELDS) {
    const value = state[field];
    if (value) {
      params.set(field, value);
    }
  }
  if (state.acquisitionYear) {
    params.set("acquisitionYear", String(state.acquisitionYear));
  }
  if (state.attention) {
    params.set("attention", "1");
  }
  if (state.sort !== DEFAULT_ASSET_LIST_SORT_KEY) {
    params.set("sort", state.sort);
  }
  if (state.dir !== DEFAULT_ASSET_LIST_SORT_DIRECTION) {
    params.set("dir", state.dir);
  }
  if (state.page !== FIRST_ASSET_LIST_PAGE) {
    params.set("page", String(state.page));
  }
  if (state.pageSize !== DEFAULT_ASSET_LIST_PAGE_SIZE) {
    params.set("pageSize", String(state.pageSize));
  }
  return params;
}

/** The same state with only `page` overridden — what every pagination link
 * needs: the current filters and sort, carried forward, on a new page. */
export function withAssetListPage(
  state: AssetListUrlState,
  page: number,
): string {
  return buildAssetListSearchParams({ ...state, page }).toString();
}
