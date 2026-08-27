import type { AssetCondition, AssetStatus } from "@/app/(app)/assets/schemas";
import { buildAttentionWhere } from "@/lib/asset-attention";
import type { db } from "@/lib/db";
import {
  buildTablePageWindow,
  countTablePages,
  DEFAULT_TABLE_PAGE_SIZE,
  FIRST_TABLE_PAGE,
  MAX_TABLE_PAGE_SIZE,
  MIN_TABLE_PAGE_SIZE,
  type SortDirection,
} from "@/lib/table-sort";

/**
 * Pure translation from the asset list's parsed filters, sort key and page
 * into the shape `db.asset.findMany` accepts (PRD FR-2.6). Kept apart from
 * `src/app/(app)/assets/queries.ts` specifically so the ticket's acceptance
 * criterion — "pagination is server-side, verified by checking the query
 * rather than the rendered result" — has something to check: a plain
 * function with no database, no `next/headers`, and unit tests beside it.
 */

/**
 * The curated set of sortable columns (issue #87): the identity code, the
 * name, the acquisition year and the creation time. `updatedAt` is gone with
 * the sort dropdown it used to live in — sorting is now done by clicking a
 * column header, and the list has no "last updated" column to click. A
 * bookmarked `?sort=updatedAt` falls back to the default, like any other
 * unknown key.
 */
export const ASSET_LIST_SORT_KEYS = [
  "assetCode",
  "name",
  "acquisitionYear",
  "createdAt",
] as const;

export type AssetListSortKey = (typeof ASSET_LIST_SORT_KEYS)[number];

export type AssetListSortDirection = SortDirection;

/**
 * Newest first (issue #87). The register's most common question is "what did
 * we just add", and asset codes ascend by category and year rather than by
 * when the row was written, so code order buried every new asset at the back
 * of the list.
 */
export const DEFAULT_ASSET_LIST_SORT_KEY: AssetListSortKey = "createdAt";
export const DEFAULT_ASSET_LIST_SORT_DIRECTION: AssetListSortDirection = "desc";

export const FIRST_ASSET_LIST_PAGE = FIRST_TABLE_PAGE;
export const DEFAULT_ASSET_LIST_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;
export const MIN_ASSET_LIST_PAGE_SIZE = MIN_TABLE_PAGE_SIZE;
export const MAX_ASSET_LIST_PAGE_SIZE = MAX_TABLE_PAGE_SIZE;

/** The six PRD FR-2.6 free-text fields. Every one goes through Prisma's
 * `contains`/`insensitive`, never a `RegExp` built from what a visitor
 * typed — there is no backtracking surface here at all (S5852, S8786). */
const ASSET_LIST_SEARCH_FIELDS = [
  "name",
  "assetCode",
  "universityAssetCode",
  "brand",
  "model",
  "serialNumber",
] as const;

type AssetListSearchField = (typeof ASSET_LIST_SEARCH_FIELDS)[number];

export interface AssetListFilters {
  readonly search?: string;
  readonly categoryId?: string;
  readonly buildingId?: string;
  readonly roomId?: string;
  readonly status?: AssetStatus;
  readonly condition?: AssetCondition;
  readonly acquisitionYear?: number;
  readonly fundingSourceId?: string;
  /** The dashboard's "requiring attention" card links here (PRD FR-9.1). Kept
   * as its own boolean rather than exposed as a status or condition value,
   * because it is a compound rule (`asset-attention.ts`), not a column. */
  readonly attention?: boolean;
}

export interface AssetListQueryInput extends AssetListFilters {
  readonly sortKey: AssetListSortKey;
  readonly sortDirection: AssetListSortDirection;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * The `where` clause `db.asset.findMany` actually wants, derived from `db`
 * itself rather than hand-typed or imported from `@/generated/prisma` — the
 * same trick `activity-writes.ts` uses for `TransactionClient`, for the same
 * reason: `import type` is erased at compile time, so this adds no runtime
 * dependency on the generated client and does not breach the seam in
 * `src/lib/db.ts` (CLAUDE.md), while still guaranteeing this function's
 * output is assignable to what Prisma expects — no hand-maintained shape to
 * drift out of sync with the schema.
 */
type AssetFindManyArgs = NonNullable<Parameters<typeof db.asset.findMany>[0]>;
export type AssetListWhere = NonNullable<AssetFindManyArgs["where"]>;

function toSearchClause(
  field: AssetListSearchField,
  search: string,
): Record<string, { contains: string; mode: "insensitive" }> {
  return { [field]: { contains: search, mode: "insensitive" } };
}

/**
 * Builds the `where` clause for the asset list. Every filter is optional and
 * they combine with AND; free-text search combines its own six fields with
 * OR. Soft-deleted assets are always excluded (PRD FR-2.5) — this is the one
 * condition that is never optional.
 */
export function buildAssetListWhere(filters: AssetListFilters): AssetListWhere {
  const trimmedSearch = filters.search?.trim();

  const where = {
    deletedAt: null,
    ...(filters.categoryId && { categoryId: filters.categoryId }),
    ...(filters.roomId && { roomId: filters.roomId }),
    ...(filters.buildingId && { room: { buildingId: filters.buildingId } }),
    ...(filters.status && { status: filters.status }),
    ...(filters.condition && { condition: filters.condition }),
    ...(filters.acquisitionYear && {
      acquisitionYear: filters.acquisitionYear,
    }),
    ...(filters.fundingSourceId && {
      fundingSourceId: filters.fundingSourceId,
    }),
    ...(trimmedSearch && {
      OR: ASSET_LIST_SEARCH_FIELDS.map((field) =>
        toSearchClause(field, trimmedSearch),
      ),
    }),
    // Nested under `AND` rather than merged as a second top-level `OR` key —
    // a plain object can only hold one `OR` key, and the search clause above
    // already claims it. Wrapping keeps the two independent regardless of
    // whether both are active at once, and leaves the search-only shape
    // (asserted by this file's existing tests) untouched when `attention` is
    // absent.
    ...(filters.attention && { AND: [buildAttentionWhere()] }),
  };

  // Prisma's generated `AssetWhereInput` is a large conditional type keyed
  // off every relation and scalar on `Asset`; asserting once at the boundary
  // here is what keeps every branch above readable, in place of a per-field
  // fight with that type. The unit tests beside this function are what
  // actually prove the *shape* is right — this cast only tells the compiler
  // what the tests already demonstrate at runtime.
  return where as AssetListWhere;
}

/** One entry, always — Prisma's `orderBy` array form is for tie-breaking on
 * more than one column, which FR-2.6 never asks for. */
export function buildAssetListOrderBy(
  sortKey: AssetListSortKey,
  sortDirection: AssetListSortDirection,
): Record<AssetListSortKey, AssetListSortDirection> {
  return { [sortKey]: sortDirection } as Record<
    AssetListSortKey,
    AssetListSortDirection
  >;
}

export interface AssetListPageWindow {
  readonly skip: number;
  readonly take: number;
}

/** Zero-based `skip`/`take` from a one-based page number. Delegates to the
 * shared arithmetic in `@/lib/table-sort` — every table pages the same way,
 * and this name is kept so the asset list's callers read as one feature. */
export function buildAssetListPageWindow(
  page: number,
  pageSize: number,
): AssetListPageWindow {
  return buildTablePageWindow(page, pageSize);
}

/** How many pages a result set spans. A pageless result (zero rows) is still
 * one page — an empty page, not zero pages — so a caller can always render
 * "page 1 of N" without a special case for the empty state. */
export function totalAssetListPageCount(
  totalCount: number,
  pageSize: number,
): number {
  return countTablePages(totalCount, pageSize);
}
