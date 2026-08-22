import type { ReactNode } from "react";

import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format-date";

import { returnLoanAction } from "./actions";
import type { LoansPlainMessageKey, LoansTranslate } from "./loan-field-specs";
import { LoanDateTime } from "./LoanDateTime";
import type { AssetOpenLoan } from "./loan-queries";
import { LoanStateBadge } from "./LoanStateBadge";
import { ReturnLoanForm } from "./ReturnLoanForm";

/**
 * The open loan on an asset's detail page (PRD FR-6.3): who has it, when it
 * went out, when it is due, and the control that brings it back.
 *
 * The state badge here is computed from `isOverdue` rather than re-derived, so
 * it agrees with the panel's own read — and it is the same badge the loans list
 * shows, so "overdue" looks identical wherever the reader meets it.
 */

interface OpenLoanDetailsProps {
  readonly loan: AssetOpenLoan;
  readonly locale: Locale;
  readonly t: LoansTranslate;
}

interface DetailFieldProps {
  readonly label: string;
  readonly children: ReactNode;
}

/** A definition-list pair, so the label and its value are associated for a
 * screen reader rather than merely adjacent on screen. */
function DetailField({ label, children }: Readonly<DetailFieldProps>) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

const BORROWER_FIELD_KEYS: readonly {
  readonly labelKey: LoansPlainMessageKey;
  readonly field: keyof Pick<
    AssetOpenLoan,
    "borrowerName" | "borrowerEmail" | "borrowerUnit" | "handledByName"
  >;
}[] = [
  { labelKey: "borrowerNameLabel", field: "borrowerName" },
  { labelKey: "borrowerEmailLabel", field: "borrowerEmail" },
  { labelKey: "borrowerUnitLabel", field: "borrowerUnit" },
  { labelKey: "handledByLabel", field: "handledByName" },
];

export function OpenLoanDetails({
  loan,
  locale,
  t,
}: Readonly<OpenLoanDetailsProps>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{t("currentLoanHeading")}</h3>
        <LoanStateBadge state={loan.isOverdue ? "overdue" : "active"} t={t} />
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BORROWER_FIELD_KEYS.map((spec) => (
          <DetailField key={spec.field} label={t(spec.labelKey)}>
            {loan[spec.field]}
          </DetailField>
        ))}
        <DetailField label={t("checkedOutAtLabel")}>
          <time dateTime={loan.checkedOutAt.toISOString()}>
            {formatDate(loan.checkedOutAt, locale)}
          </time>
        </DetailField>
        <DetailField label={t("dueAtLabel")}>
          <LoanDateTime
            value={loan.dueAt}
            locale={locale}
            relativeKey="dueOn"
            t={t}
          />
        </DetailField>
        {loan.notes ? (
          <DetailField label={t("notesLabel")}>{loan.notes}</DetailField>
        ) : null}
      </dl>
      <ReturnLoanForm
        action={returnLoanAction}
        loanId={loan.id}
        submitLabel={t("returnSubmit")}
        submitPendingLabel={t("returnPending")}
      />
    </div>
  );
}
