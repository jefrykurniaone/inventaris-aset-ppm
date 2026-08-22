"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { ASSETS_PATH, LOANS_PATH } from "@/lib/paths";
import { requireUser } from "@/lib/require-user";

import {
  CHECK_OUT_FIELD_ERROR_KEYS,
  type LoansPlainMessageKey,
  type LoansTranslate,
} from "./loan-field-specs";
import type { LoanFailureReason } from "./loan-writes";
import { checkOutAsset, returnLoan } from "./mutations";
import {
  CHECK_OUT_FIELD_NAMES,
  checkOutSchema,
  INITIAL_RETURN_LOAN_STATE,
  loanAssetIdSchema,
  loanIdSchema,
  REQUIRED_CHECK_OUT_FIELD_NAMES,
  type CheckOutFieldErrors,
  type CheckOutFieldName,
  type LoanFormState,
  type ReturnLoanState,
} from "./schemas";

/**
 * Server actions for the loan register (PRD FR-6, issue #15).
 *
 * `requireUser()`, not `requireAdmin()`, is the first statement of both:
 * FR-1.4 gives `staff` the run of the asset register, and handing an item over
 * and taking it back is part of running it. The signed-in user is the actor on
 * the `Loan` row (`handledById`) and on the activity row, so the trail names
 * who did it and not merely that it happened.
 *
 * Nothing here decides anything. Both actions validate the submission, hand it
 * to a mutation, and turn whatever comes back into a localised message —
 * every rule lives in `src/lib/loan-transitions.ts` and every write in
 * `./loan-writes.ts`.
 */

const CHECK_OUT_FIELD_NAME_SET: ReadonlySet<string> = new Set(
  CHECK_OUT_FIELD_NAMES,
);
const REQUIRED_FIELD_NAME_SET: ReadonlySet<string> = new Set(
  REQUIRED_CHECK_OUT_FIELD_NAMES,
);

const FAILURE_MESSAGE_KEYS: Readonly<
  Record<LoanFailureReason, LoansPlainMessageKey>
> = {
  ASSET_NOT_FOUND: "assetNotFound",
  ASSET_ALREADY_LOANED: "assetAlreadyLoaned",
  ASSET_NOT_AVAILABLE: "assetNotAvailable",
  DUE_DATE_IN_PAST: "dueAtInPast",
  LOAN_NOT_FOUND: "loanNotFound",
  LOAN_ALREADY_RETURNED: "loanAlreadyReturned",
};

/** The one refusal that belongs under a field rather than above the form: the
 * user typed the due date, so the message goes where they typed it. */
const DUE_DATE_REFUSAL: LoanFailureReason = "DUE_DATE_IN_PAST";

function isCheckOutFieldName(value: PropertyKey): value is CheckOutFieldName {
  return typeof value === "string" && CHECK_OUT_FIELD_NAME_SET.has(value);
}

function buildFieldErrors(
  t: LoansTranslate,
  issues: ReadonlyArray<{ path: PropertyKey[] }>,
): CheckOutFieldErrors {
  const fieldErrors: CheckOutFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isCheckOutFieldName(field)) {
      fieldErrors[field] = t(CHECK_OUT_FIELD_ERROR_KEYS[field]);
    }
  }
  return fieldErrors;
}

/**
 * Reads one form entry. `formData.get` returns `string | File | null`, and
 * `String(...)` on a `File` yields `[object File]` (S6551), which would then be
 * validated as though it were a field value — anything that is not a string
 * reads as absent, and so does an optional field submitted empty.
 */
function readField(
  formData: FormData,
  name: CheckOutFieldName,
): string | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") {
    return undefined;
  }
  if (value.trim() === "" && !REQUIRED_FIELD_NAME_SET.has(name)) {
    return undefined;
  }
  return value;
}

function parseCheckOutForm(formData: FormData) {
  const raw: Partial<Record<CheckOutFieldName, string>> = {};
  for (const field of CHECK_OUT_FIELD_NAMES) {
    const value = readField(formData, field);
    if (value !== undefined) {
      raw[field] = value;
    }
  }
  return checkOutSchema.safeParse(raw);
}

function toCheckOutFailure(
  t: LoansTranslate,
  reason: LoanFailureReason,
): LoanFormState {
  const message = t(FAILURE_MESSAGE_KEYS[reason]);
  if (reason === DUE_DATE_REFUSAL) {
    return {
      fieldErrors: { dueAt: message },
      formError: null,
      isSuccess: false,
    };
  }
  return { fieldErrors: {}, formError: message, isSuccess: false };
}

/** Both list surfaces and the one detail page a loan change is visible on. */
function revalidateLoanSurfaces(assetId: string): void {
  revalidatePath(LOANS_PATH);
  revalidatePath(ASSETS_PATH);
  revalidatePath(`${ASSETS_PATH}/${assetId}`);
}

/**
 * Checks an asset out to a borrower (FR-6.1). The asset id comes from a hidden
 * field, and is validated like every other entry point — the mutation then
 * refuses anything that is not an `active`, un-withdrawn asset, so a forged id
 * buys nothing but a localised refusal.
 */
export async function checkOutAssetAction(
  _previousState: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const user = await requireUser();
  const t = await getTranslations("LoansPage");
  const assetId = loanAssetIdSchema.parse(formData.get("assetId"));
  const parsed = parseCheckOutForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await checkOutAsset({ ...parsed.data, assetId }, user.id);
  if (!result.ok) {
    return toCheckOutFailure(t, result.reason);
  }

  revalidateLoanSurfaces(assetId);
  return { fieldErrors: {}, formError: null, isSuccess: true };
}

/** Records a return (FR-6.1). A loan already closed is refused rather than
 * re-stamped — see `refuseReturn`. */
export async function returnLoanAction(
  _previousState: ReturnLoanState,
  formData: FormData,
): Promise<ReturnLoanState> {
  const user = await requireUser();
  const t = await getTranslations("LoansPage");
  const loanId = loanIdSchema.parse(formData.get("loanId"));

  const result = await returnLoan(loanId, user.id);
  if (!result.ok) {
    return { formError: t(FAILURE_MESSAGE_KEYS[result.reason]) };
  }

  revalidateLoanSurfaces(result.assetId);
  return INITIAL_RETURN_LOAN_STATE;
}
