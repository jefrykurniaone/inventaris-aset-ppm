import {
  DEFAULT_ASSET_LIST_PAGE_SIZE,
  DEFAULT_ASSET_LIST_SORT_DIRECTION,
  DEFAULT_ASSET_LIST_SORT_KEY,
  FIRST_ASSET_LIST_PAGE,
  type AssetListSortDirection,
  type AssetListSortKey,
} from "./asset-list-query";
import { appendTableViewParams, type TableViewDefaults } from "./table-sort";

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

const VIEW_DEFAULTS: TableViewDefaults = {
  sort: DEFAULT_ASSET_LIST_SORT_KEY,
  dir: DEFAULT_ASSET_LIST_SORT_DIRECTION,
};

/** Only the view controls — sort key, direction and page size. What the
 * filter form carries as hidden fields, so applying a filter keeps the
 * ordering and the page size the reader chose instead of silently resetting
 * both. `page` is deliberately reset: a changed filter belongs on page 1. */
export function buildAssetListViewParams(
  state: AssetListUrlState,
): URLSearchParams {
  return appendTableViewParams(
    new URLSearchParams(),
    { ...state, page: FIRST_ASSET_LIST_PAGE },
    VIEW_DEFAULTS,
  );
}

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
  return appendTableViewParams(params, state, VIEW_DEFAULTS);
}

/** The same state with only `page` overridden — what every pagination link
 * needs: the current filters and sort, carried forward, on a new page. */
export function withAssetListPage(
  state: AssetListUrlState,
  page: number,
): string {
  return buildAssetListSearchParams({ ...state, page }).toString();
}

/**
 * The whole view a sortable column header leads to: the current filters, the
 * requested ordering, and the page reset to the first — a reader who reorders
 * the register wants the top of the new order, not row 41 of it.
 */
export function withAssetListSort(
  state: AssetListUrlState,
  sort: AssetListSortKey,
  dir: AssetListSortDirection,
): URLSearchParams {
  return buildAssetListSearchParams({
    ...state,
    sort,
    dir,
    page: FIRST_ASSET_LIST_PAGE,
  });
}

/**
 * Everything except the page size, for the page-size form to carry as hidden
 * fields — its `<select>` supplies that one. `page` resets with it: a page
 * number counted in twenty-row pages points somewhere else entirely once the
 * pages hold a hundred rows.
 */
export function buildAssetListParamsWithoutPageSize(
  state: AssetListUrlState,
): URLSearchParams {
  return buildAssetListSearchParams({
    ...state,
    page: FIRST_ASSET_LIST_PAGE,
    pageSize: DEFAULT_ASSET_LIST_PAGE_SIZE,
  });
}
