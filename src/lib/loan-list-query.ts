import type { db } from "@/lib/db";
import type { LoanState } from "@/lib/loan-transitions";

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

export interface LoanListQueryInput extends LoanListFilters {
  readonly page: number;
  readonly pageSize: number;
}

export const FIRST_LOAN_LIST_PAGE = 1;
export const DEFAULT_LOAN_LIST_PAGE_SIZE = 20;
export const MIN_LOAN_LIST_PAGE_SIZE = 10;
export const MAX_LOAN_LIST_PAGE_SIZE = 100;

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
 * Earliest due date first, so the most overdue item heads the list, with `id`
 * as a tie-break. The tie-break is not cosmetic: `uuid(7)` is time-ordered, so
 * it gives the result set a total order and stops a row with a shared `dueAt`
 * from appearing on two pages or on neither as the reader pages through.
 */
export function buildLoanListOrderBy(): LoanListOrderBy {
  return [{ dueAt: "asc" }, { id: "asc" }];
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
  const safePage = page < FIRST_LOAN_LIST_PAGE ? FIRST_LOAN_LIST_PAGE : page;
  return { skip: (safePage - 1) * pageSize, take: pageSize };
}

/** How many pages a result set spans. Zero rows is one empty page, not zero
 * pages, so the pager can always render "page 1 of N". */
export function totalLoanListPageCount(
  totalCount: number,
  pageSize: number,
): number {
  if (totalCount <= 0) {
    return FIRST_LOAN_LIST_PAGE;
  }
  return Math.ceil(totalCount / pageSize);
}
