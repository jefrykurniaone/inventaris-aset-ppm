import { z } from "zod";

import {
  appendTableViewParams,
  buildTablePageWindow,
  countTablePages,
  DEFAULT_TABLE_PAGE_SIZE,
  FIRST_TABLE_PAGE,
  readPageParam,
  readPageSizeParam,
  readSortDirection,
  readSortKey,
  type SortDirection,
  type TableViewDefaults,
} from "./table-sort";

/**
 * The admin user list's view state (issue #87): which column it is sorted on,
 * in which direction, and which page of what size.
 *
 * The list is read through Better Auth's `admin()` plugin rather than through
 * Prisma — `auth.api.listUsers` is the only way this codebase reads the
 * `user` table, and `src/lib/auth.ts` is the only place Better Auth is
 * configured (CLAUDE.md). So this module produces the plugin's own query
 * shape (`limit` / `offset` / `sortBy` / `sortDirection`) rather than a
 * Prisma `orderBy`, and imports nothing from Better Auth to do it.
 *
 * Everything here is pure, so the whitelist and the clamping are asserted
 * directly in `user-list-query.test.ts`.
 */

/** The curated sortable set: identity (name), the address people are found
 * by (email), and when the account was created. Role, status and the
 * deactivation reason carry no header sort — the first two have three or two
 * distinct values, which sorts nothing useful, and the third is prose. */
export const USER_LIST_SORT_KEYS = ["name", "email", "createdAt"] as const;

export type UserListSortKey = (typeof USER_LIST_SORT_KEYS)[number];

/** Newest account first (issue #87). The reason to open this page is almost
 * always the account somebody just created. */
export const DEFAULT_USER_LIST_SORT_KEY: UserListSortKey = "createdAt";
export const DEFAULT_USER_LIST_SORT_DIRECTION: SortDirection = "desc";

export interface UserListParams {
  readonly sort: UserListSortKey;
  readonly dir: SortDirection;
  readonly page: number;
  readonly pageSize: number;
}

const userListSearchParamsSchema = z.object({
  sort: z
    .unknown()
    .optional()
    .transform((raw): UserListSortKey =>
      readSortKey(raw, USER_LIST_SORT_KEYS, DEFAULT_USER_LIST_SORT_KEY),
    ),
  dir: z
    .unknown()
    .optional()
    .transform((raw): SortDirection =>
      readSortDirection(raw, DEFAULT_USER_LIST_SORT_DIRECTION),
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

/** Validates `/admin/users`'s URL search params. Never throws: a search param
 * is an HTTP entry point a visitor can hand-edit, so every unknown sort key,
 * bad direction, zero page and out-of-range page size falls back to its
 * default rather than failing the page. */
export function parseUserListParams(raw: unknown): UserListParams {
  return userListSearchParamsSchema.parse(raw ?? {});
}

/** What `auth.api.listUsers` is asked for. Named after the plugin's own query
 * fields so the call site is a straight spread. */
export interface UserListQuery {
  readonly limit: number;
  readonly offset: number;
  readonly sortBy: UserListSortKey;
  readonly sortDirection: SortDirection;
}

export function buildUserListQuery(params: UserListParams): UserListQuery {
  const { skip, take } = buildTablePageWindow(params.page, params.pageSize);
  return {
    limit: take,
    offset: skip,
    sortBy: params.sort,
    sortDirection: params.dir,
  };
}

export function totalUserListPageCount(
  totalCount: number,
  pageSize: number,
): number {
  return countTablePages(totalCount, pageSize);
}

const VIEW_DEFAULTS: TableViewDefaults = {
  sort: DEFAULT_USER_LIST_SORT_KEY,
  dir: DEFAULT_USER_LIST_SORT_DIRECTION,
};

export function buildUserListSearchParams(
  params: UserListParams,
): URLSearchParams {
  return appendTableViewParams(new URLSearchParams(), params, VIEW_DEFAULTS);
}

/** The view a sortable column header leads to: requested ordering, back to
 * page 1. */
export function withUserListSort(
  params: UserListParams,
  sort: UserListSortKey,
  dir: SortDirection,
): URLSearchParams {
  return buildUserListSearchParams({
    ...params,
    sort,
    dir,
    page: FIRST_TABLE_PAGE,
  });
}

/** The pager's params: everything but `page`, which the pager sets itself. */
export function buildUserListPagerParams(
  params: UserListParams,
): URLSearchParams {
  return buildUserListSearchParams({ ...params, page: FIRST_TABLE_PAGE });
}

/** The page-size form's hidden fields: everything but the page size, with
 * `page` reset — a page number counted in ten-row pages points somewhere else
 * once the pages hold a hundred. */
export function buildUserListParamsWithoutPageSize(
  params: UserListParams,
): URLSearchParams {
  return buildUserListSearchParams({
    ...params,
    page: FIRST_TABLE_PAGE,
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
  });
}
