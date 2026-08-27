import { z } from "zod";

import type { db } from "@/lib/db";
import {
  SIGN_IN_ATTEMPT_OUTCOMES,
  type SignInAttemptOutcome,
} from "@/lib/sign-in-lockout";
import {
  appendTableViewParams,
  buildTablePageWindow,
  countTablePages,
  DEFAULT_TABLE_PAGE_SIZE,
  FIRST_TABLE_PAGE,
  readPageParam,
  readPageSizeParam,
  readParamString,
  readSortDirection,
  readSortKey,
  type SortDirection,
  type TableViewDefaults,
} from "@/lib/table-sort";

/**
 * The admin sign-in activity trail's view state (issue #125): parse, validate,
 * filter and paginate, in one pure module with no database import and no
 * `next/headers` — the same shape `@/lib/user-list-query` and
 * `@/lib/loan-list-query` already establish for their own lists, so the
 * filter combinations, the pagination clamping, the defaults and the invalid
 * input all have a plain function to assert against in
 * `sign-in-activity-list-query.test.ts` rather than a rendered page.
 *
 * Database reads live in the page's own `queries.ts` on the shared `db` seam,
 * deliberately not in `@/lib/sign-in-attempts.ts` — that module's fail-open,
 * swallow-and-log error handling exists for a lockout decision on the
 * unauthenticated sign-in path, where availability outranks a missed read.
 * An admin audit page has the opposite priority: a broken query should fail
 * loudly rather than quietly render as "no attempts."
 */

/** The one sortable column: newest first by default (issue #125's acceptance
 * criterion), toggled by the shared `SortableColumnHeader`. Address and
 * outcome carry no header sort — outcome has three values, which sorts
 * nothing useful, and address is free text a reviewer searches rather than
 * orders by. */
export const SIGN_IN_ACTIVITY_LIST_SORT_KEYS = ["createdAt"] as const;

export type SignInActivityListSortKey =
  (typeof SIGN_IN_ACTIVITY_LIST_SORT_KEYS)[number];

export const DEFAULT_SIGN_IN_ACTIVITY_SORT_KEY: SignInActivityListSortKey =
  "createdAt";
export const DEFAULT_SIGN_IN_ACTIVITY_SORT_DIRECTION: SortDirection = "desc";

/** Same bound `@/app/(app)/loans/list-schemas.ts` uses for its own free-text
 * search: generous for a real address, small enough that it cannot be used to
 * pad a request. */
const SEARCH_MAX_LENGTH = 200;

export interface SignInActivityListFilters {
  /** Matched against the attempted address with Prisma's
   * `contains`/`insensitive` — never a `RegExp` built from what an admin
   * typed, so there is no backtracking surface here at all (S5852, S8786). */
  readonly search?: string;
  readonly outcome?: SignInAttemptOutcome;
}

export interface SignInActivityListParams extends SignInActivityListFilters {
  readonly sort: SignInActivityListSortKey;
  readonly dir: SortDirection;
  readonly page: number;
  readonly pageSize: number;
}

const searchTerm = z
  .unknown()
  .optional()
  .transform((raw): string | undefined => {
    const value = readParamString(raw);
    return value !== undefined && value.length <= SEARCH_MAX_LENGTH
      ? value
      : undefined;
  });

const outcomeFilter = z
  .unknown()
  .optional()
  .transform((raw): SignInAttemptOutcome | undefined => {
    const value = readParamString(raw);
    return value !== undefined &&
      (SIGN_IN_ATTEMPT_OUTCOMES as readonly string[]).includes(value)
      ? (value as SignInAttemptOutcome)
      : undefined;
  });

const signInActivityListSearchParamsSchema = z.object({
  search: searchTerm,
  outcome: outcomeFilter,
  sort: z
    .unknown()
    .optional()
    .transform((raw): SignInActivityListSortKey =>
      readSortKey(
        raw,
        SIGN_IN_ACTIVITY_LIST_SORT_KEYS,
        DEFAULT_SIGN_IN_ACTIVITY_SORT_KEY,
      ),
    ),
  dir: z
    .unknown()
    .optional()
    .transform((raw): SortDirection =>
      readSortDirection(raw, DEFAULT_SIGN_IN_ACTIVITY_SORT_DIRECTION),
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

/** Validates `/admin/sign-in-activity`'s URL search params. Never throws: a
 * search param is an HTTP entry point an admin can hand-edit or bookmark, so
 * an unknown outcome, an over-long search term, a bad sort or direction and an
 * out-of-range page all fall back to their default rather than failing the
 * page. */
export function parseSignInActivityListParams(
  raw: unknown,
): SignInActivityListParams {
  return signInActivityListSearchParamsSchema.parse(raw ?? {});
}

/**
 * Derived from `db` itself, the same trick `@/lib/asset-list-query` and
 * `@/lib/loan-list-query` use: `import type` is erased at compile time, so
 * this adds no runtime dependency on the generated Prisma client and does not
 * breach the seam `src/lib/db.ts` owns (CLAUDE.md), while still tying this
 * module's output to the schema.
 */
type SignInAttemptFindManyArgs = NonNullable<
  Parameters<typeof db.signInAttempt.findMany>[0]
>;
export type SignInActivityListWhere = NonNullable<
  SignInAttemptFindManyArgs["where"]
>;

/** The `where` clause for one page of the trail. The outcome filter and the
 * address search combine with AND; with neither given, every attempt
 * matches. */
export function buildSignInActivityListWhere(
  filters: SignInActivityListFilters,
): SignInActivityListWhere {
  const trimmedSearch = filters.search?.trim();

  const where = {
    ...(filters.outcome && { outcome: filters.outcome }),
    ...(trimmedSearch && {
      email: { contains: trimmedSearch, mode: "insensitive" },
    }),
  };

  // One assertion at the boundary, the same way `buildAssetListWhere` and
  // `buildLoanListWhere` do it: Prisma's generated `SignInAttemptWhereInput`
  // is a conditional type, and the unit tests beside this function are what
  // prove the shape is right.
  return where as SignInActivityListWhere;
}

/** One entry, always — there is exactly one sortable column, so there is
 * nothing to tie-break on. */
export function buildSignInActivityListOrderBy(
  sortKey: SignInActivityListSortKey,
  sortDirection: SortDirection,
): Record<SignInActivityListSortKey, SortDirection> {
  return { [sortKey]: sortDirection } as Record<
    SignInActivityListSortKey,
    SortDirection
  >;
}

export interface SignInActivityListPageWindow {
  readonly skip: number;
  readonly take: number;
}

/** Zero-based `skip`/`take` from a one-based page number. Delegates to the
 * shared arithmetic in `@/lib/table-sort` — every table in this application
 * pages the same way. */
export function buildSignInActivityListPageWindow(
  page: number,
  pageSize: number,
): SignInActivityListPageWindow {
  return buildTablePageWindow(page, pageSize);
}

/** How many pages a result set spans. Zero attempts is still one empty page,
 * so the pager can always render "page 1 of N". */
export function totalSignInActivityListPageCount(
  totalCount: number,
  pageSize: number,
): number {
  return countTablePages(totalCount, pageSize);
}

const VIEW_DEFAULTS: TableViewDefaults = {
  sort: DEFAULT_SIGN_IN_ACTIVITY_SORT_KEY,
  dir: DEFAULT_SIGN_IN_ACTIVITY_SORT_DIRECTION,
};

/** Every param of one trail view, defaults omitted, filters included. The
 * pager, the sort header and the page-size control all go through it. */
export function buildSignInActivityListSearchParams(
  params: SignInActivityListParams,
): URLSearchParams {
  const search = new URLSearchParams();
  if (params.search) {
    search.set("search", params.search);
  }
  if (params.outcome) {
    search.set("outcome", params.outcome);
  }
  return appendTableViewParams(search, params, VIEW_DEFAULTS);
}

/** The view a sortable column header leads to: same filters, requested
 * ordering, back to page 1. */
export function withSignInActivityListSort(
  params: SignInActivityListParams,
  sort: SignInActivityListSortKey,
  dir: SortDirection,
): URLSearchParams {
  return buildSignInActivityListSearchParams({
    ...params,
    sort,
    dir,
    page: FIRST_TABLE_PAGE,
  });
}

/** The pager's params: everything but `page`, which the pager sets itself. */
export function buildSignInActivityListPagerParams(
  params: SignInActivityListParams,
): URLSearchParams {
  return buildSignInActivityListSearchParams({
    ...params,
    page: FIRST_TABLE_PAGE,
  });
}

/** Only the view controls — sort, direction and page size — never a filter.
 * The filter form's own `search` and `outcome` inputs already carry those, so
 * mirroring them here as hidden fields too would double them up in the query
 * string. `page` resets, because a changed filter belongs on page 1. */
export function buildSignInActivityListViewParams(
  params: SignInActivityListParams,
): URLSearchParams {
  return appendTableViewParams(
    new URLSearchParams(),
    { ...params, page: FIRST_TABLE_PAGE },
    VIEW_DEFAULTS,
  );
}

/** The page-size form's hidden fields: everything but the page size, with
 * `page` reset — a page number counted in ten-row pages points somewhere else
 * once the pages hold a hundred. */
export function buildSignInActivityListParamsWithoutPageSize(
  params: SignInActivityListParams,
): URLSearchParams {
  return buildSignInActivityListSearchParams({
    ...params,
    page: FIRST_TABLE_PAGE,
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
  });
}
