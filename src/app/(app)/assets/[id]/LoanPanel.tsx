import { getLocale, getTranslations } from "next-intl/server";

import { checkOutAssetAction } from "@/app/(app)/loans/actions";
import {
  CheckOutForm,
  type CheckOutFormLabels,
} from "@/app/(app)/loans/CheckOutForm";
import type { LoansTranslate } from "@/app/(app)/loans/loan-field-specs";
import { findAssetLoanPanel } from "@/app/(app)/loans/loan-queries";
import { LoanHistoryList } from "@/app/(app)/loans/LoanHistoryList";
import { OpenLoanDetails } from "@/app/(app)/loans/OpenLoanDetails";
import { CHECK_OUT_FROM_STATUS } from "@/lib/loan-transitions";

import type { AssetStatus } from "../schemas";

/**
 * The loan panel on an asset's detail page (PRD FR-6, issue #15).
 *
 * This replaces issue #10's stub body at the same mount point, as that ticket
 * said it would. It now renders one of three things, and which one is decided
 * by the loan row rather than by the asset's status label:
 *
 *  - an open loan, with the borrower, the dates, an overdue indicator and the
 *    return control;
 *  - the check-out form, when the asset is `active` and free;
 *  - a note that the asset cannot be lent, for any other status.
 *
 * Reading the loan rather than the status is what makes drift *visible* instead
 * of invisible: if an asset were somehow `loaned` with no open loan, this panel
 * would say so rather than render an empty box. Nothing can put it in that
 * state — see the invariant note in `src/app/(app)/loans/loan-writes.ts` — but a
 * panel that would quietly hide the failure is not the place to rely on it.
 *
 * Unlike the stub, this renders for *every* status. Loan history belongs to an
 * asset whatever it is doing now, and hiding the check-out control behind a
 * status the reader cannot see is how a feature acquires a reputation for being
 * missing.
 */

interface LoanPanelProps {
  readonly assetId: string;
  readonly assetCode: string;
  readonly status: AssetStatus;
}

function checkOutLabels(t: LoansTranslate): CheckOutFormLabels {
  return {
    heading: t("checkOutHeading"),
    intro: t("checkOutIntro"),
    borrowerName: t("borrowerNameLabel"),
    borrowerEmail: t("borrowerEmailLabel"),
    borrowerUnit: t("borrowerUnitLabel"),
    dueAt: t("dueAtLabel"),
    notes: t("notesLabel"),
    submit: t("checkOutSubmit"),
    submitPending: t("checkOutPending"),
  };
}

interface IdleLoanPanelProps {
  readonly assetId: string;
  readonly status: AssetStatus;
  readonly t: LoansTranslate;
}

/**
 * What the panel shows when there is no open loan: the check-out form if the
 * asset is free to lend, and the reason it is not otherwise. Split out so
 * `LoanPanel` itself stays a read followed by a render (S3776).
 */
function IdleLoanPanel({ assetId, status, t }: Readonly<IdleLoanPanelProps>) {
  if (status !== CHECK_OUT_FROM_STATUS) {
    return (
      <p className="text-muted-foreground text-sm">{t("notAvailableToLend")}</p>
    );
  }
  return (
    <CheckOutForm
      action={checkOutAssetAction}
      assetId={assetId}
      labels={checkOutLabels(t)}
    />
  );
}

export async function LoanPanel({
  assetId,
  assetCode,
  status,
}: Readonly<LoanPanelProps>) {
  const [locale, t, td] = await Promise.all([
    getLocale(),
    getTranslations("LoansPage"),
    getTranslations("AssetDetailPage"),
  ]);
  const { openLoan, history, hasMoreHistory } = await findAssetLoanPanel(
    assetId,
    new Date(),
  );

  return (
    <section
      aria-labelledby="asset-loan-heading"
      className="border-border bg-muted/40 flex flex-col gap-4 rounded-md border p-4"
    >
      <h2 id="asset-loan-heading" className="text-lg font-semibold">
        {td("loanHeading")}
      </h2>
      {openLoan ? (
        <OpenLoanDetails loan={openLoan} locale={locale} t={t} />
      ) : (
        <IdleLoanPanel assetId={assetId} status={status} t={t} />
      )}
      <LoanHistoryList
        entries={history}
        hasMore={hasMoreHistory}
        assetCode={assetCode}
        locale={locale}
        t={t}
      />
    </section>
  );
}
