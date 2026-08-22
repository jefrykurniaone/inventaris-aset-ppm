import { z } from "zod";

/**
 * The loan register's shared validation (PRD FR-6, issue #15). One schema,
 * authoritative on the server and importable unchanged by the client form —
 * this module imports nothing from `next/headers`, `@/lib/db` or `@/lib/auth`,
 * so it carries no server-only dependency into the browser bundle. A
 * `"use server"` file may only export async functions, which is why the schemas
 * and the form-state type live here rather than in `actions.ts`.
 *
 * What this file does **not** decide: whether the due date is in the future,
 * whether the asset may be checked out at all, and whether a loan may be
 * returned. Those are transition rules, they depend on the state of a row this
 * module cannot see, and they live in `src/lib/loan-transitions.ts` where they
 * are unit-tested against a fixed clock. This file only decides whether the
 * submission is well-formed.
 */

const SHORT_TEXT_MAX_LENGTH = 200;
const NOTES_MAX_LENGTH = 2000;

/** `<input type="date">` submits `YYYY-MM-DD`. Anchored and fully bounded —
 * no ambiguous repetition to backtrack on (S5852, S8786). */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A due date names a *day*, and the item is due back by the end of it. The
 * stored instant is therefore the last millisecond of that day in the one time
 * zone this system lives in — the same `Asia/Jakarta` that
 * `src/lib/format-date.ts` pins every rendered date to.
 *
 * Storing UTC midnight instead, the way the asset form stores `warrantyUntil`,
 * would be wrong here rather than merely different: an item due on 22 August
 * would count as overdue from one minute past midnight on 22 August, for the
 * whole of the day it is actually due. The offset is written out rather than
 * computed because WIB is UTC+7 year-round with no daylight saving, so there
 * is no rule to apply — only a constant.
 */
const END_OF_DAY_IN_JAKARTA = "T23:59:59.999+07:00";

function toDueInstant(value: string): Date {
  return new Date(`${value}${END_OF_DAY_IN_JAKARTA}`);
}

/**
 * A `NaN` check alone is not enough: V8 silently rolls `2027-02-30` forward to
 * 2 March rather than rejecting it, so a typed-in day that does not exist would
 * be stored as a different, plausible-looking date. Round-tripping the parsed
 * instant back to `YYYY-MM-DD` catches the rollover — 23:59:59.999+07:00 is
 * 16:59:59.999Z on the *same* calendar day, so the ISO string still starts with
 * the submitted date whenever the date was real.
 */
function isRealCalendarDate(value: string): boolean {
  const parsed = toDueInstant(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().startsWith(value);
}

const requiredShortText = z.string().trim().min(1).max(SHORT_TEXT_MAX_LENGTH);

export const loanIdSchema = z.string().trim().min(1);
export const loanAssetIdSchema = z.string().trim().min(1);

export const checkOutSchema = z.object({
  borrowerName: requiredShortText,
  borrowerEmail: z.email().max(SHORT_TEXT_MAX_LENGTH),
  borrowerUnit: requiredShortText,
  dueAt: z
    .string()
    .trim()
    .regex(ISO_DATE_PATTERN)
    .refine(isRealCalendarDate)
    .transform(toDueInstant),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX_LENGTH)
    .optional()
    .transform((value) => value ?? null),
});

export type CheckOutInput = z.infer<typeof checkOutSchema>;

/** Every field the check-out form submits, in the order it presents them.
 * Used to read the submission out of `FormData` and to map Zod issue paths
 * onto localised field errors. */
export const CHECK_OUT_FIELD_NAMES = [
  "borrowerName",
  "borrowerEmail",
  "borrowerUnit",
  "dueAt",
  "notes",
] as const;

export type CheckOutFieldName = (typeof CHECK_OUT_FIELD_NAMES)[number];

/** The fields whose only accepted submission is a non-empty value. `notes`
 * reads an empty input as "not given". */
export const REQUIRED_CHECK_OUT_FIELD_NAMES: readonly CheckOutFieldName[] = [
  "borrowerName",
  "borrowerEmail",
  "borrowerUnit",
  "dueAt",
];

export type CheckOutFieldErrors = Partial<Record<CheckOutFieldName, string>>;

export interface LoanFormState {
  readonly fieldErrors: CheckOutFieldErrors;
  readonly formError: string | null;
  readonly isSuccess: boolean;
}

export const INITIAL_LOAN_FORM_STATE: LoanFormState = {
  fieldErrors: {},
  formError: null,
  isSuccess: false,
};

/** The return action has no fields of its own — the loan id identifies
 * everything it needs — so it reports only a form-level message. */
export interface ReturnLoanState {
  readonly formError: string | null;
}

export const INITIAL_RETURN_LOAN_STATE: ReturnLoanState = { formError: null };
