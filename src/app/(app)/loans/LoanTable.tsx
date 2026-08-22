import type { Locale } from "@/i18n/config";

import type { LoansPlainMessageKey, LoansTranslate } from "./loan-field-specs";
import type { LoanListRow } from "./list-queries";
import { LoanCard, LoanRow } from "./LoanRow";

/**
 * The loans list (PRD FR-6). A `<table>` at `md` and above and a list of cards
 * below it, both rendered from the same rows and switched by CSS
 * (`hidden md:block` / `md:hidden`) rather than by a client-side breakpoint
 * check — no hydration mismatch, and no horizontal page scroll on a phone.
 * The same construction `AssetTable` uses, for the same reasons.
 */

const COLUMN_KEYS: readonly LoansPlainMessageKey[] = [
  "columnAsset",
  "columnBorrower",
  "columnCheckedOutAt",
  "columnDueAt",
  "columnReturnedAt",
  "columnState",
];

interface LoanTableProps {
  readonly loans: readonly LoanListRow[];
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
              {COLUMN_KEYS.map((key) => (
                <th key={key} scope="col" className="py-2 pr-4 font-medium">
                  {t(key)}
                </th>
              ))}
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
