import { z } from "zod";

import {
  DEFAULT_LOAN_LIST_PAGE_SIZE,
  DEFAULT_LOAN_LIST_SORT_DIRECTION,
  DEFAULT_LOAN_LIST_SORT_KEY,
  FIRST_LOAN_LIST_PAGE,
  LOAN_LIST_SORT_KEYS,
  type LoanListSortKey,
} from "@/lib/loan-list-query";
import { LOAN_STATES, type LoanState } from "@/lib/loan-transitions";
import {
  appendTableViewParams,
  readPageParam,
  readPageSizeParam,
  readParamString,
  readSortDirection,
  readSortKey,
  type SortDirection,
  type TableViewDefaults,
} from "@/lib/table-sort";

/**
 * Validates `/loans`'s URL search params (PRD FR-6). A search param is an HTTP
 * entry point a visitor can hand-edit or bookmark, so every one of these falls
 * back to a default rather than throwing and failing the page — the same
 * fallback-not-throw contract `../assets/list-schemas.ts` establishes, built
 * the same way, out of `z.unknown().optional().transform(...)` so that the
 * `string[]` shape Next.js hands back for a repeated param reads as "not
 * given" instead of blowing up.
 *
 * `q` is a search box a signed-in user typed into, and it lands in the URL like
 * any other search term. That is the one place a borrower's name may appear in
 * a URL, and only because the user put it there: nothing this application
 * *generates* — no link, no redirect, no row id — ever carries borrower data.
 * The state filter links do not, and neither does the pager.
 */

const SEARCH_MAX_LENGTH = 200;

/** Trimming, whitelisting and clamping all come from `@/lib/table-sort`
 * (issue #87), so every table in this application reads its view params
 * through exactly one implementation. */
const readParam = readParamString;

const searchTerm = z
  .unknown()
  .optional()
  .transform((raw) => {
    const value = readParam(raw);
    return value !== undefined && value.length <= SEARCH_MAX_LENGTH
      ? value
      : undefined;
  });

const stateFilter = z
  .unknown()
  .optional()
  .transform((raw): LoanState | undefined => {
    const value = readParam(raw);
    return value !== undefined &&
      (LOAN_STATES as readonly string[]).includes(value)
      ? (value as LoanState)
      : undefined;
  });

const sortKeyParam = z
  .unknown()
  .optional()
  .transform((raw): LoanListSortKey =>
    readSortKey(raw, LOAN_LIST_SORT_KEYS, DEFAULT_LOAN_LIST_SORT_KEY),
  );

const sortDirectionParam = z
  .unknown()
  .optional()
  .transform((raw): SortDirection =>
    readSortDirection(raw, DEFAULT_LOAN_LIST_SORT_DIRECTION),
  );

const pageParam = z
  .unknown()
  .optional()
  .transform((raw) => readPageParam(raw));

const pageSizeParam = z
  .unknown()
  .optional()
  .transform((raw) => readPageSizeParam(raw));

export const loanListSearchParamsSchema = z.object({
  q: searchTerm,
  state: stateFilter,
  sort: sortKeyParam,
  dir: sortDirectionParam,
  page: pageParam,
  pageSize: pageSizeParam,
});

export type LoanListSearchParams = z.infer<typeof loanListSearchParamsSchema>;

const VIEW_DEFAULTS: TableViewDefaults = {
  sort: DEFAULT_LOAN_LIST_SORT_KEY,
  dir: DEFAULT_LOAN_LIST_SORT_DIRECTION,
};

/** Every param of one loans-list view, defaults omitted. The one function
 * that writes a loans-list URL, kept next to the one that reads it — so it
 * is plain to see that nothing but the user's own search term ever goes in.
 * The pager, the sort headers, the filter form and the page-size control all
 * go through it. */
export function buildLoanListSearchParams(
  params: LoanListSearchParams,
): URLSearchParams {
  const search = new URLSearchParams();
  if (params.q) {
    search.set("q", params.q);
  }
  if (params.state) {
    search.set("state", params.state);
  }
  return appendTableViewParams(search, params, VIEW_DEFAULTS);
}

/** The query string for one page of the current view, with every other param
 * preserved. */
export function withLoanListPage(
  params: LoanListSearchParams,
  page: number,
): string {
  return buildLoanListSearchParams({ ...params, page }).toString();
}

/** The view a sortable column header leads to: same filters, requested
 * ordering, back to page 1. */
export function withLoanListSort(
  params: LoanListSearchParams,
  sort: LoanListSortKey,
  dir: SortDirection,
): URLSearchParams {
  return buildLoanListSearchParams({
    ...params,
    sort,
    dir,
    page: FIRST_LOAN_LIST_PAGE,
  });
}

/** Only the view controls, for the filter form's hidden fields — `page`
 * reset, because a changed filter belongs on page 1. */
export function buildLoanListViewParams(
  params: LoanListSearchParams,
): URLSearchParams {
  return appendTableViewParams(
    new URLSearchParams(),
    { ...params, page: FIRST_LOAN_LIST_PAGE },
    VIEW_DEFAULTS,
  );
}

/** Everything except the page size, for the page-size form's hidden fields —
 * its `<select>` supplies that one, and `page` resets with it. */
export function buildLoanListParamsWithoutPageSize(
  params: LoanListSearchParams,
): URLSearchParams {
  return buildLoanListSearchParams({
    ...params,
    page: FIRST_LOAN_LIST_PAGE,
    pageSize: DEFAULT_LOAN_LIST_PAGE_SIZE,
  });
}
