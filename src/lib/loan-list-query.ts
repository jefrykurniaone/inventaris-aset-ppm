import type { db } from "@/lib/db";
import type { LoanState } from "@/lib/loan-transitions";
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
 * Pure translation from the loans list's parsed filters and page number into
 * the shape `db.loan.findMany` accepts (PRD FR-6, issue #15). The same split
 * `src/lib/asset-list-query.ts` makes for the asset register, and for the same
 * reason: the filtering is done by the database, so there has to be a query to
 * check rather than a rendered table to eyeball.
 *
 * The `where` for each state is derived from `now`, never from a stored flag —
 * see the note on `isLoanOverdue` in `src/lib/loan-transitions.ts`. The three
 * clauses below are the exact `where`-clause counterparts of `loanStateOf`, so
 * a row the `overdue` filter returns is a row the badge renders as overdue.
 *
 * Soft-deleted assets are **not** excluded. The asset list hides them (FR-2.5),
 * but a loan is a record of an item somebody is holding: hiding an open loan
 * because the asset row was withdrawn would make an outstanding item vanish
 * from the one view that exists to chase it.
 */

/** The loan columns and relations free-text search looks in. Prisma
 * `contains`/`insensitive` throughout — never a `RegExp` built from typed
 * input, so there is no backtracking surface at all (S5852, S8786). */
const LOAN_SEARCH_CLAUSE_BUILDERS = [
  (term: string) => ({ borrowerName: { contains: term, mode: "insensitive" } }),
  (term: string) => ({
    asset: { name: { contains: term, mode: "insensitive" } },
  }),
  (term: string) => ({
    asset: { assetCode: { contains: term, mode: "insensitive" } },
  }),
] as const;

export interface LoanListFilters {
  /** Free text, matched against the borrower's name and the asset's name and
   * code. Borrower email and unit are deliberately absent: an email address is
   * the identifier most useful to someone fishing, and neither is a term a
   * colleague searches by. */
  readonly search?: string;
  readonly state?: LoanState;
}

/**
 * The curated set of sortable columns (issue #87): the asset's identity code
 * and the loan's three dates. Borrower and state carry no header sort —
 * borrower is three stacked fields with no single column to order by, and
 * state is derived from `dueAt` and `returnedAt` rather than stored, so there
 * is nothing for a database `ORDER BY` to name.
 */
export const LOAN_LIST_SORT_KEYS = [
  "assetCode",
  "checkedOutAt",
  "dueAt",
  "returnedAt",
] as const;

export type LoanListSortKey = (typeof LOAN_LIST_SORT_KEYS)[number];

/** Due soonest first, unchanged by issue #87. This list's job is chasing due
 * dates, so the most overdue item heads it — the one table whose default is
 * deliberately not newest-first. */
export const DEFAULT_LOAN_LIST_SORT_KEY: LoanListSortKey = "dueAt";
export const DEFAULT_LOAN_LIST_SORT_DIRECTION: SortDirection = "asc";

export interface LoanListQueryInput extends LoanListFilters {
  readonly sortKey: LoanListSortKey;
  readonly sortDirection: SortDirection;
  readonly page: number;
  readonly pageSize: number;
}

export const FIRST_LOAN_LIST_PAGE = FIRST_TABLE_PAGE;
export const DEFAULT_LOAN_LIST_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;
export const MIN_LOAN_LIST_PAGE_SIZE = MIN_TABLE_PAGE_SIZE;
export const MAX_LOAN_LIST_PAGE_SIZE = MAX_TABLE_PAGE_SIZE;

/**
 * Derived from `db` itself rather than imported from `@/generated/prisma` —
 * `import type` is erased, so this adds no runtime dependency on the generated
 * client and does not breach the seam `src/lib/db.ts` owns (CLAUDE.md), while
 * still tying the output of every builder below to the schema.
 */
type LoanFindManyArgs = NonNullable<Parameters<typeof db.loan.findMany>[0]>;
export type LoanListWhere = NonNullable<LoanFindManyArgs["where"]>;

/** An overdue loan: open, and past its due date at `now`. Exported on its own
 * because the dashboard's overdue count and the list's `overdue` filter are the
 * same question asked twice, and one definition is what keeps the card's number
 * equal to the number of rows the link leads to. */
export function buildOverdueLoanWhere(now: Date): LoanListWhere {
  return { returnedAt: null, dueAt: { lt: now } } as LoanListWhere;
}

function buildStateWhere(state: LoanState, now: Date): LoanListWhere {
  if (state === "returned") {
    return { returnedAt: { not: null } } as LoanListWhere;
  }
  if (state === "overdue") {
    return buildOverdueLoanWhere(now);
  }
  return { returnedAt: null, dueAt: { gte: now } } as LoanListWhere;
}

/**
 * The `where` clause for one page of the loans list. State and free text
 * combine with AND; the free-text fields combine with OR among themselves.
 * With no state given, every loan matches — the unfiltered view.
 */
export function buildLoanListWhere(
  filters: LoanListFilters,
  now: Date,
): LoanListWhere {
  const trimmedSearch = filters.search?.trim();

  const where = {
    ...(filters.state && buildStateWhere(filters.state, now)),
    ...(trimmedSearch && {
      OR: LOAN_SEARCH_CLAUSE_BUILDERS.map((build) => build(trimmedSearch)),
    }),
  };

  // One assertion at the boundary, the same way `buildAssetListWhere` does it:
  // Prisma's generated `LoanWhereInput` is a large conditional type, and the
  // unit tests beside this function are what prove the shape is right.
  return where as LoanListWhere;
}

/** Mutable, not `readonly`: Prisma's generated `orderBy` input rejects a
 * readonly tuple or array outright — the same trap `src/lib/asset-visibility.ts`
 * documents for its own sort orders. */
export type LoanListOrderBy = Record<string, "asc" | "desc">[];

/**
 * The requested column, with `id` as a tie-break. The tie-break is not
 * cosmetic: `uuid(7)` is time-ordered, so it gives the result set a total
 * order and stops a row with a shared sort value from appearing on two pages
 * or on neither as the reader pages through.
 *
 * `assetCode` lives on the related asset, so it orders through the relation
 * rather than through a column of `loan`.
 */
export function buildLoanListOrderBy(
  sortKey: LoanListSortKey,
  sortDirection: SortDirection,
): LoanListOrderBy {
  const primary =
    sortKey === "assetCode"
      ? { asset: { assetCode: sortDirection } }
      : { [sortKey]: sortDirection };
  return [primary as Record<string, "asc" | "desc">, { id: sortDirection }];
}

export interface LoanListPageWindow {
  readonly skip: number;
  readonly take: number;
}

/** Zero-based `skip`/`take` from a one-based page number. A page below 1 reads
 * as page 1 rather than producing a negative `skip`; `list-schemas.ts` already
 * clamps it, and this stays correct without trusting that. */
export function buildLoanListPageWindow(
  page: number,
  pageSize: number,
): LoanListPageWindow {
  return buildTablePageWindow(page, pageSize);
}

/** How many pages a result set spans. Zero rows is one empty page, not zero
 * pages, so the pager can always render "page 1 of N". */
export function totalLoanListPageCount(
  totalCount: number,
  pageSize: number,
): number {
  return countTablePages(totalCount, pageSize);
}
