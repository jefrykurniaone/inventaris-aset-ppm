import Link from "next/link";

import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format-date";
import { LOANS_PATH } from "@/lib/paths";

import type { LoansTranslate } from "./loan-field-specs";
import type { AssetLoanHistoryEntry } from "./loan-queries";
import { LoanStateBadge } from "./LoanStateBadge";

/**
 * One asset's past loans (PRD FR-6.3), newest return first.
 *
 * Capped at `ASSET_LOAN_HISTORY_LIMIT` with a link to the loans list filtered
 * to this asset rather than an unbounded render — the same constraint the
 * activity timeline works under, and a plain link rather than client-side
 * paging state, so the whole surface still works with JavaScript disabled.
 *
 * The "see all" link searches by the asset's *code*. The loans list searches
 * borrower name and asset name and code with one term, so the code is the only
 * one of the three that identifies an asset unambiguously — and it is the one
 * value in this component that is safe to put in a generated URL.
 */

interface LoanHistoryListProps {
  readonly entries: readonly AssetLoanHistoryEntry[];
  readonly hasMore: boolean;
  readonly assetCode: string;
  readonly locale: Locale;
  readonly t: LoansTranslate;
}

function HistoryEntry({
  entry,
  locale,
  t,
}: Readonly<{
  entry: AssetLoanHistoryEntry;
  locale: Locale;
  t: LoansTranslate;
}>) {
  const returnedLabel = entry.returnedAt
    ? formatDate(entry.returnedAt, locale)
    : t("notReturnedYet");

  return (
    <li className="border-border flex flex-col gap-1 border-b pb-3 text-sm last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{entry.borrowerName}</span>
        <LoanStateBadge state={entry.state} t={t} />
      </div>
      <span className="text-muted-foreground">{entry.borrowerUnit}</span>
      <span className="text-muted-foreground">
        {t("historyEntryDates", {
          checkedOut: formatDate(entry.checkedOutAt, locale),
          due: formatDate(entry.dueAt, locale),
          returned: returnedLabel,
        })}
      </span>
      <span className="text-muted-foreground text-xs">
        {t("handledByLine", { name: entry.handledByName })}
      </span>
    </li>
  );
}

export function LoanHistoryList({
  entries,
  hasMore,
  assetCode,
  locale,
  t,
}: Readonly<LoanHistoryListProps>) {
  return (
    <section
      aria-labelledby="asset-loan-history-heading"
      className="flex flex-col gap-3"
    >
      <h3 id="asset-loan-history-heading" className="font-medium">
        {t("historyHeading")}
      </h3>
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("historyEmpty")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((entry) => (
            <HistoryEntry key={entry.id} entry={entry} locale={locale} t={t} />
          ))}
        </ol>
      )}
      {hasMore ? (
        <Link
          href={`${LOANS_PATH}?q=${encodeURIComponent(assetCode)}`}
          className="text-primary text-sm hover:underline"
        >
          {t("historyShowAll")}
        </Link>
      ) : null}
    </section>
  );
}
