import { db } from "@/lib/db";
import {
  buildLoanListOrderBy,
  buildLoanListPageWindow,
  buildLoanListWhere,
  buildOverdueLoanWhere,
  type LoanListQueryInput,
} from "@/lib/loan-list-query";
import { loanStateOf, type LoanState } from "@/lib/loan-transitions";

/**
 * Reads for the loans list (PRD FR-6) and for the dashboard's overdue count.
 *
 * Every filter, the sort and the page window come from the pure translation in
 * `@/lib/loan-list-query`, so the filtering happens at the database and there
 * is a query to check rather than a rendered table to eyeball. `state` is the
 * one field computed after the read: it is derived from `dueAt` and
 * `returnedAt` by the same `loanStateOf` the `where` clauses mirror, so the
 * badge on a row always agrees with the filter that found it.
 *
 * This is an authenticated surface, so borrower name, email and unit are
 * selected here. The public scan page reads a different, narrower selection
 * that never names them — see `src/lib/asset-visibility.ts`.
 */

export interface LoanListRow {
  readonly id: string;
  readonly assetId: string;
  readonly assetCode: string;
  readonly assetName: string;
  readonly borrowerName: string;
  readonly borrowerEmail: string;
  readonly borrowerUnit: string;
  readonly checkedOutAt: Date;
  readonly dueAt: Date;
  readonly returnedAt: Date | null;
  readonly state: LoanState;
}

export interface LoanListPageResult {
  readonly rows: readonly LoanListRow[];
  readonly totalCount: number;
}

const LOAN_LIST_SELECT = {
  id: true,
  assetId: true,
  borrowerName: true,
  borrowerEmail: true,
  borrowerUnit: true,
  checkedOutAt: true,
  dueAt: true,
  returnedAt: true,
  asset: { select: { assetCode: true, name: true } },
} as const;

interface LoanListRowSource {
  readonly id: string;
  readonly assetId: string;
  readonly borrowerName: string;
  readonly borrowerEmail: string;
  readonly borrowerUnit: string;
  readonly checkedOutAt: Date;
  readonly dueAt: Date;
  readonly returnedAt: Date | null;
  readonly asset: { readonly assetCode: string; readonly name: string };
}

function toLoanListRow(loan: LoanListRowSource, now: Date): LoanListRow {
  return {
    id: loan.id,
    assetId: loan.assetId,
    assetCode: loan.asset.assetCode,
    assetName: loan.asset.name,
    borrowerName: loan.borrowerName,
    borrowerEmail: loan.borrowerEmail,
    borrowerUnit: loan.borrowerUnit,
    checkedOutAt: loan.checkedOutAt,
    dueAt: loan.dueAt,
    returnedAt: loan.returnedAt,
    state: loanStateOf(loan, now),
  };
}

/**
 * One page of the loan register, filtered, sorted and paginated at the
 * database. `now` is passed in rather than read here so that the `where`
 * clause, the row states and anything the page renders alongside them all
 * describe the same instant — a request that straddled a due date would
 * otherwise be able to show a row the `active` filter found wearing an
 * `overdue` badge.
 */
export async function listLoansPage(
  query: LoanListQueryInput,
  now: Date,
): Promise<LoanListPageResult> {
  const where = buildLoanListWhere(query, now);
  const { skip, take } = buildLoanListPageWindow(query.page, query.pageSize);

  const [loans, totalCount] = await Promise.all([
    db.loan.findMany({
      where,
      orderBy: buildLoanListOrderBy(query.sortKey, query.sortDirection),
      skip,
      take,
      select: LOAN_LIST_SELECT,
    }),
    db.loan.count({ where }),
  ]);

  return {
    rows: loans.map((loan) => toLoanListRow(loan, now)),
    totalCount,
  };
}

/** How many loans are overdue right now (PRD FR-6.4's dashboard figure). The
 * same `where` the list's `overdue` filter uses, so the card's number is
 * exactly the number of rows its link leads to. */
export async function countOverdueLoans(now: Date): Promise<number> {
  return db.loan.count({ where: buildOverdueLoanWhere(now) });
}
