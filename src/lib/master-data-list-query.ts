import { z } from "zod";

import {
  appendTableViewParams,
  DEFAULT_TABLE_PAGE_SIZE,
  FIRST_TABLE_PAGE,
  readPageParam,
  readPageSizeParam,
  readSortDirection,
  readSortKey,
  type SortDirection,
} from "./table-sort";

/**
 * The view state the four master-data lists share (issue #87): categories,
 * buildings, rooms and funding sources. All four are the same shape of
 * screen — a create form, a table of lookup rows, an activate/deactivate
 * toggle — so all four sort, page and serialise the same way, and one
 * generic module is what keeps them from drifting into four.
 *
 * The default stays code order (name order for funding sources, which have
 * no code): these are reference tables people scan for a known code, not
 * feeds people check for what is new.
 *
 * Everything here is pure — no database, no `next/headers` — so the whitelist
 * and the clamping are asserted directly in `master-data-list-query.test.ts`.
 */

/** Every column a coded master-data table sorts on. */
export const MASTER_DATA_SORT_KEYS = ["code", "name", "createdAt"] as const;

export type MasterDataSortKey = (typeof MASTER_DATA_SORT_KEYS)[number];

export const DEFAULT_MASTER_DATA_SORT_KEY: MasterDataSortKey = "code";
export const DEFAULT_MASTER_DATA_SORT_DIRECTION: SortDirection = "asc";

/** Funding sources have no code column — `FundingSource.name` is the unique
 * one — so their whitelist is the same list minus `code`. */
export const FUNDING_SOURCE_SORT_KEYS = ["name", "createdAt"] as const;

export type FundingSourceSortKey = (typeof FUNDING_SOURCE_SORT_KEYS)[number];

export const DEFAULT_FUNDING_SOURCE_SORT_KEY: FundingSourceSortKey = "name";

export interface MasterDataListParams<Key extends string> {
  readonly sort: Key;
  readonly dir: SortDirection;
  readonly page: number;
  readonly pageSize: number;
}

function masterDataListSchema<Key extends string>(
  allowedKeys: readonly Key[],
  defaultKey: Key,
) {
  return z.object({
    sort: z
      .unknown()
      .optional()
      .transform((raw): Key => readSortKey(raw, allowedKeys, defaultKey)),
    dir: z
      .unknown()
      .optional()
      .transform((raw): SortDirection =>
        readSortDirection(raw, DEFAULT_MASTER_DATA_SORT_DIRECTION),
      ),
    page: z
      .unknown()
      .optional()
      .transform((raw) => readPageParam(raw)),
    pageSize: z
      .unknown()
      .optional()
      .transform((raw) => readPageSizeParam(raw)),
  });
}

/** Validates one master-data list's URL search params against that list's own
 * whitelist. Never throws: every unknown key, bad direction, zero page and
 * out-of-range page size falls back to its default. Extra params the page
 * carries for its own filters — the room list's `buildingId` — are ignored
 * here and parsed by that page's own schema. */
export function parseMasterDataListParams<Key extends string>(
  raw: unknown,
  allowedKeys: readonly Key[],
  defaultKey: Key,
): MasterDataListParams<Key> {
  return masterDataListSchema(allowedKeys, defaultKey).parse(raw ?? {});
}

/** Prisma's generated `orderBy` input rejects a readonly array outright — the
 * same trap `src/lib/loan-list-query.ts` documents for its own sort orders. */
export type MasterDataOrderBy = Record<string, unknown>[];

/**
 * The requested column with `id` as a tie-break. The tie-break is not
 * cosmetic: `uuid(7)` is time-ordered, so it gives the result set a total
 * order and stops a row with a shared name or timestamp from appearing on two
 * pages or on neither as the reader pages through.
 */
export function buildMasterDataOrderBy(
  sortKey: string,
  direction: SortDirection,
): MasterDataOrderBy {
  return [{ [sortKey]: direction }, { id: direction }];
}

/**
 * Rooms order by building first when they order by code: `Room.code` is
 * unique only within its building (`@@unique([buildingId, code])`), so room
 * code alone interleaves two buildings' rooms into nonsense.
 */
export function buildRoomListOrderBy(
  sortKey: MasterDataSortKey,
  direction: SortDirection,
): MasterDataOrderBy {
  if (sortKey === "code") {
    return [
      { building: { code: direction } },
      { code: direction },
      { id: direction },
    ];
  }
  return buildMasterDataOrderBy(sortKey, direction);
}

function viewDefaults<Key extends string>(defaultKey: Key) {
  return { sort: defaultKey, dir: DEFAULT_MASTER_DATA_SORT_DIRECTION };
}

/**
 * One master-data list URL. `base` carries whatever filter the page has of
 * its own — the room list's `buildingId`, nothing at all for the other
 * three — and the four view params are appended to it with every default
 * omitted.
 */
export function buildMasterDataListSearchParams<Key extends string>(
  base: URLSearchParams,
  state: MasterDataListParams<Key>,
  defaultKey: Key,
): URLSearchParams {
  return appendTableViewParams(
    new URLSearchParams(base),
    state,
    viewDefaults(defaultKey),
  );
}

/** The view a sortable column header leads to: same filter, requested
 * ordering, back to page 1. */
export function withMasterDataSort<Key extends string>(
  base: URLSearchParams,
  state: MasterDataListParams<Key>,
  defaultKey: Key,
  sort: Key,
  direction: SortDirection,
): URLSearchParams {
  return buildMasterDataListSearchParams(
    base,
    { ...state, sort, dir: direction, page: FIRST_TABLE_PAGE },
    defaultKey,
  );
}

/** The pager's params: everything but `page`, which the pager sets itself. */
export function buildMasterDataPagerParams<Key extends string>(
  base: URLSearchParams,
  state: MasterDataListParams<Key>,
  defaultKey: Key,
): URLSearchParams {
  return buildMasterDataListSearchParams(
    base,
    { ...state, page: FIRST_TABLE_PAGE },
    defaultKey,
  );
}

/** The page-size form's hidden fields: everything but the page size, with
 * `page` reset alongside it. */
export function buildMasterDataParamsWithoutPageSize<Key extends string>(
  base: URLSearchParams,
  state: MasterDataListParams<Key>,
  defaultKey: Key,
): URLSearchParams {
  return buildMasterDataListSearchParams(
    base,
    { ...state, page: FIRST_TABLE_PAGE, pageSize: DEFAULT_TABLE_PAGE_SIZE },
    defaultKey,
  );
}
