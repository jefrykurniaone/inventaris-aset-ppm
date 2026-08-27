import type { TableColumnSpec } from "@/components/table-columns";
import { TableHeaderCells } from "@/components/TableHeaderCells";
import type { Locale } from "@/i18n/config";
import type { LoanListSortKey } from "@/lib/loan-list-query";
import { LOANS_PATH } from "@/lib/paths";
import type { SortDirection } from "@/lib/table-sort";

import type { LoansPlainMessageKey, LoansTranslate } from "./loan-field-specs";
import { withLoanListSort, type LoanListSearchParams } from "./list-schemas";
import type { LoanListRow } from "./list-queries";
import { LoanCard, LoanRow } from "./LoanRow";

/**
 * The loans list (PRD FR-6). A `<table>` at `md` and above and a list of cards
 * below it, both rendered from the same rows and switched by CSS
 * (`hidden md:block` / `md:hidden`) rather than by a client-side breakpoint
 * check — no hydration mismatch, and no horizontal page scroll on a phone.
 * The same construction `AssetTable` uses, for the same reasons.
 */

interface LoanColumn {
  readonly id: string;
  readonly labelKey: LoansPlainMessageKey;
  readonly sortKey?: LoanListSortKey;
  readonly initialDirection?: SortDirection;
}

/** The curated sortable set (issue #87): the asset's code and the three
 * dates. Borrower is three stacked fields with no single column behind it,
 * and state is derived rather than stored — neither is something a database
 * `ORDER BY` can name. */
const LOAN_COLUMNS: readonly LoanColumn[] = [
  { id: "asset", labelKey: "columnAsset", sortKey: "assetCode" },
  { id: "borrower", labelKey: "columnBorrower" },
  {
    id: "checkedOutAt",
    labelKey: "columnCheckedOutAt",
    sortKey: "checkedOutAt",
    initialDirection: "desc",
  },
  { id: "dueAt", labelKey: "columnDueAt", sortKey: "dueAt" },
  {
    id: "returnedAt",
    labelKey: "columnReturnedAt",
    sortKey: "returnedAt",
    initialDirection: "desc",
  },
  { id: "state", labelKey: "columnState" },
];

function toColumnSpecs(
  t: LoansTranslate,
): readonly TableColumnSpec<LoanListSortKey>[] {
  return LOAN_COLUMNS.map((column) => ({
    id: column.id,
    label: t(column.labelKey),
    sortKey: column.sortKey,
    initialDirection: column.initialDirection,
  }));
}

interface LoanTableProps {
  readonly loans: readonly LoanListRow[];
  readonly params: LoanListSearchParams;
  readonly locale: Locale;
  readonly t: LoansTranslate;
  /** Distinguishes the two empty states: an empty register reads "no loans
   * recorded", a filter with no matches reads "no loans match" — the same zero
   * rows, two different messages, so nobody reads "nothing has ever been lent"
   * when they have simply filtered too narrowly. */
  readonly isFilteredView: boolean;
}

export function LoanTable({
  loans,
  params,
  locale,
  t,
  isFilteredView,
}: Readonly<LoanTableProps>) {
  if (loans.length === 0) {
    const emptyStateKey = isFilteredView ? "emptyStateFiltered" : "emptyState";
    return <p className="text-muted-foreground text-sm">{t(emptyStateKey)}</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border border-b">
              <TableHeaderCells
                action={LOANS_PATH}
                columns={toColumnSpecs(t)}
                sortKey={params.sort}
                direction={params.dir}
                paramsFor={(sortKey, direction) =>
                  withLoanListSort(params, sortKey, direction)
                }
              />
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <LoanRow key={loan.id} loan={loan} locale={locale} t={t} />
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {loans.map((loan) => (
          <LoanCard key={loan.id} loan={loan} locale={locale} t={t} />
        ))}
      </ul>
    </>
  );
}
