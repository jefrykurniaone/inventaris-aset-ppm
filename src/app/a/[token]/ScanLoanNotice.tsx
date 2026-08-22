import { getLocale, getTranslations } from "next-intl/server";

import { formatDate, formatDateTime } from "@/lib/format-date";

import type { ScanLoanBorrower, ScanOpenLoan } from "./queries";
import { ScanField, ScanFieldGroup } from "./ScanFieldList";

/**
 * The loan state on a public page (PRD FR-6.2).
 *
 * An anonymous visitor gets one sentence: the item is out, and when it is due
 * back. No name, no email, no unit — not because this component hides them,
 * but because `ANONYMOUS_ASSET_SCAN_SELECT` never asked the database for them,
 * so `borrower` is `null` and there is nothing here to hide. The sub-component
 * below cannot render for an anonymous visitor even if someone edits the
 * condition away.
 */

async function ScanLoanBorrowerFields({
  borrower,
}: Readonly<{ borrower: ScanLoanBorrower }>) {
  const [locale, ts] = await Promise.all([
    getLocale(),
    getTranslations("ScanPage"),
  ]);

  return (
    <ScanFieldGroup
      headingId="scan-borrower-heading"
      heading={ts("borrowerHeading")}
      note={ts("restrictedNote")}
    >
      <ScanField label={ts("borrowerNameLabel")} value={borrower.name} />
      <ScanField label={ts("borrowerEmailLabel")} value={borrower.email} />
      <ScanField label={ts("borrowerUnitLabel")} value={borrower.unit} />
      <ScanField label={ts("handledByLabel")} value={borrower.handledByName} />
      <ScanField
        label={ts("checkedOutAtLabel")}
        value={formatDateTime(borrower.checkedOutAt, locale)}
      />
    </ScanFieldGroup>
  );
}

export async function ScanLoanNotice({
  loan,
}: Readonly<{ loan: ScanOpenLoan }>) {
  const [locale, ts] = await Promise.all([
    getLocale(),
    getTranslations("ScanPage"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="scan-loan-heading"
        className="border-border bg-muted/40 flex flex-col gap-1 rounded-md border p-4"
      >
        <h2 id="scan-loan-heading" className="text-lg font-semibold">
          {ts("onLoanHeading")}
        </h2>
        <p>{ts("onLoanDueOn", { dueAt: formatDate(loan.dueAt, locale) })}</p>
      </section>
      {loan.borrower ? (
        <ScanLoanBorrowerFields borrower={loan.borrower} />
      ) : null}
    </div>
  );
}
