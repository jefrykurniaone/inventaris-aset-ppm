import Link from "next/link";

import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format-date";
import { ASSETS_PATH } from "@/lib/paths";

import type { LoansTranslate } from "./loan-field-specs";
import { LoanDateTime } from "./LoanDateTime";
import type { LoanListRow } from "./list-queries";
import { LoanStateBadge } from "./LoanStateBadge";

/**
 * One row of the loans list, and one card of its narrow-viewport counterpart.
 * Split out of `LoanTable.tsx` so that component's own body stays a short list
 * of calls — the same reason `AssetRow` is split out of `AssetTable`.
 *
 * The link goes to the asset, not to a loan page: there is no per-loan route,
 * because everything a loan can be *done* to — returning it — belongs on the
 * asset it concerns, beside its history.
 */

interface LoanRowProps {
  readonly loan: LoanListRow;
  readonly locale: Locale;
  readonly t: LoansTranslate;
}

const CELL_CLASS = "py-2 pr-4 align-top";

function AssetLink({ loan }: Readonly<{ loan: LoanListRow }>) {
  return (
    <Link
      href={`${ASSETS_PATH}/${loan.assetId}`}
      className="text-primary font-mono hover:underline"
    >
      {loan.assetCode}
    </Link>
  );
}

/** Name, unit and email together. All three are personal data and all three
 * are here because this is an authenticated route; none of them is ever put
 * into a link, and no public surface selects them at all. */
function Borrower({ loan }: Readonly<{ loan: LoanListRow }>) {
  return (
    <span className="flex flex-col">
      <span className="font-medium">{loan.borrowerName}</span>
      <span className="text-muted-foreground text-xs">{loan.borrowerUnit}</span>
      <span className="text-muted-foreground text-xs">
        {loan.borrowerEmail}
      </span>
    </span>
  );
}

export function LoanRow({ loan, locale, t }: Readonly<LoanRowProps>) {
  return (
    <tr className="border-border border-b last:border-b-0">
      <td className={CELL_CLASS}>
        <span className="flex flex-col">
          <AssetLink loan={loan} />
          <span>{loan.assetName}</span>
        </span>
      </td>
      <td className={CELL_CLASS}>
        <Borrower loan={loan} />
      </td>
      <td className={CELL_CLASS}>
        <time dateTime={loan.checkedOutAt.toISOString()}>
          {formatDate(loan.checkedOutAt, locale)}
        </time>
      </td>
      <td className={CELL_CLASS}>
        <LoanDateTime
          value={loan.dueAt}
          locale={locale}
          relativeKey="dueOn"
          t={t}
        />
      </td>
      <td className={CELL_CLASS}>
        {loan.returnedAt ? (
          <LoanDateTime
            value={loan.returnedAt}
            locale={locale}
            relativeKey="returnedOn"
            t={t}
          />
        ) : (
          <span className="text-muted-foreground">{t("notReturnedYet")}</span>
        )}
      </td>
      <td className={CELL_CLASS}>
        <LoanStateBadge state={loan.state} t={t} />
      </td>
    </tr>
  );
}

export function LoanCard({ loan, locale, t }: Readonly<LoanRowProps>) {
  return (
    <li className="border-border flex flex-col gap-2 rounded-md border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AssetLink loan={loan} />
        <LoanStateBadge state={loan.state} t={t} />
      </div>
      <span className="font-medium">{loan.assetName}</span>
      <Borrower loan={loan} />
      <LoanDateTime
        value={loan.dueAt}
        locale={locale}
        relativeKey="dueOn"
        t={t}
      />
      {loan.returnedAt ? (
        <LoanDateTime
          value={loan.returnedAt}
          locale={locale}
          relativeKey="returnedOn"
          t={t}
        />
      ) : null}
    </li>
  );
}
