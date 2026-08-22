import { db } from "@/lib/db";
import {
  isLoanOverdue,
  loanStateOf,
  type LoanState,
} from "@/lib/loan-transitions";

/**
 * The loan reads for one asset's detail page (PRD FR-6, issue #15): the open
 * loan, if there is one, and the loans that came before it.
 *
 * Separate from `./list-queries.ts` — that file answers "which loans across the
 * register", this one answers "what has happened to this asset" — and both stay
 * well under the project's 300-line limit as a result.
 *
 * This is an authenticated route, so the borrower is selected. Nothing here is
 * reachable from `/a/<token>`: the public scan page has its own query and its
 * own selection, which never names a borrower column at all.
 */

/** How many past loans the detail page lists before deferring to the loans
 * list. An asset that has been out fifty times has a history worth paging,
 * and the detail page is not the place to page it. */
export const ASSET_LOAN_HISTORY_LIMIT = 10;

export interface AssetOpenLoan {
  readonly id: string;
  readonly borrowerName: string;
  readonly borrowerEmail: string;
  readonly borrowerUnit: string;
  readonly checkedOutAt: Date;
  readonly dueAt: Date;
  readonly notes: string | null;
  readonly handledByName: string;
  readonly isOverdue: boolean;
}

export interface AssetLoanHistoryEntry {
  readonly id: string;
  readonly borrowerName: string;
  readonly borrowerUnit: string;
  readonly checkedOutAt: Date;
  readonly dueAt: Date;
  readonly returnedAt: Date | null;
  readonly handledByName: string;
  readonly state: LoanState;
}

export interface AssetLoanPanelData {
  readonly openLoan: AssetOpenLoan | null;
  readonly history: readonly AssetLoanHistoryEntry[];
  readonly hasMoreHistory: boolean;
}

/** At most one open loan can exist per asset — see the invariant note in
 * `./loan-writes.ts` — so this takes one row rather than defending against a
 * second that cannot be written. */
const OPEN_LOAN_LIMIT = 1;

const OPEN_LOAN_SELECT = {
  id: true,
  borrowerName: true,
  borrowerEmail: true,
  borrowerUnit: true,
  checkedOutAt: true,
  dueAt: true,
  notes: true,
  handledBy: { select: { name: true } },
} as const;

const HISTORY_SELECT = {
  id: true,
  borrowerName: true,
  borrowerUnit: true,
  checkedOutAt: true,
  dueAt: true,
  returnedAt: true,
  handledBy: { select: { name: true } },
} as const;

function selectOpenLoan(assetId: string) {
  return db.loan.findMany({
    where: { assetId, returnedAt: null },
    orderBy: { dueAt: "asc" },
    take: OPEN_LOAN_LIMIT,
    select: OPEN_LOAN_SELECT,
  });
}

/** Closed loans only, newest return first. The open loan is the panel's
 * headline and would read oddly as the first line of its own history. One row
 * past the limit is fetched so "there are more" costs no second query. */
function selectHistory(assetId: string) {
  return db.loan.findMany({
    where: { assetId, returnedAt: { not: null } },
    orderBy: { returnedAt: "desc" },
    take: ASSET_LOAN_HISTORY_LIMIT + 1,
    select: HISTORY_SELECT,
  });
}

type OpenLoanRow = Awaited<ReturnType<typeof selectOpenLoan>>[number];
type HistoryRow = Awaited<ReturnType<typeof selectHistory>>[number];

function toOpenLoan(row: OpenLoanRow, now: Date): AssetOpenLoan {
  return {
    id: row.id,
    borrowerName: row.borrowerName,
    borrowerEmail: row.borrowerEmail,
    borrowerUnit: row.borrowerUnit,
    checkedOutAt: row.checkedOutAt,
    dueAt: row.dueAt,
    notes: row.notes,
    handledByName: row.handledBy.name,
    isOverdue: isLoanOverdue({ dueAt: row.dueAt, returnedAt: null }, now),
  };
}

function toHistoryEntry(row: HistoryRow, now: Date): AssetLoanHistoryEntry {
  return {
    id: row.id,
    borrowerName: row.borrowerName,
    borrowerUnit: row.borrowerUnit,
    checkedOutAt: row.checkedOutAt,
    dueAt: row.dueAt,
    returnedAt: row.returnedAt,
    handledByName: row.handledBy.name,
    state: loanStateOf(row, now),
  };
}

/** Everything the asset detail page's loan panel renders, in two queries. */
export async function findAssetLoanPanel(
  assetId: string,
  now: Date,
): Promise<AssetLoanPanelData> {
  const [openLoans, historyRows] = await Promise.all([
    selectOpenLoan(assetId),
    selectHistory(assetId),
  ]);

  const [openLoan] = openLoans;
  const hasMoreHistory = historyRows.length > ASSET_LOAN_HISTORY_LIMIT;
  const windowed = hasMoreHistory
    ? historyRows.slice(0, ASSET_LOAN_HISTORY_LIMIT)
    : historyRows;

  return {
    openLoan: openLoan ? toOpenLoan(openLoan, now) : null,
    history: windowed.map((row) => toHistoryEntry(row, now)),
    hasMoreHistory,
  };
}
