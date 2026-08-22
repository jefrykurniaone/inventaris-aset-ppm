import type { getTranslations } from "next-intl/server";

import type { LoanState } from "@/lib/loan-transitions";

import type { CheckOutFieldName } from "./schemas";

/**
 * The loan register's shared message-key mappings, in a plain module with no
 * JSX and no server-only import, so a Server Component page, a server action
 * and a table row all read the same mapping rather than three that can drift.
 * The same role `../assets/asset-field-specs.ts` plays for the asset register.
 */

export type LoansTranslate = Awaited<
  ReturnType<typeof getTranslations<"LoansPage">>
>;

type LoansMessageKey = Parameters<LoansTranslate>[0];

/**
 * The keys callable as a bare `t(key)`.
 *
 * `t(key)` where `key` is the union of *every* key in the namespace demands a
 * values argument, because some members of that union interpolate. Excluding
 * those keeps every label below callable without one, and makes adding a
 * seventh parameterised key a compile error here rather than a runtime
 * `undefined` in the interface.
 */
export type LoansPlainMessageKey = Exclude<
  LoansMessageKey,
  | "dueOn"
  | "handledByLine"
  | "historyEntryDates"
  | "overdueCardCount"
  | "paginationSummary"
  | "returnedOn"
>;

/** One localised message per check-out field, reused across the fields whose
 * only failure mode is the shared length bound. */
export const CHECK_OUT_FIELD_ERROR_KEYS: Readonly<
  Record<CheckOutFieldName, LoansPlainMessageKey>
> = {
  borrowerName: "borrowerNameRequired",
  borrowerEmail: "borrowerEmailInvalid",
  borrowerUnit: "borrowerUnitRequired",
  dueAt: "dueAtInvalid",
  notes: "notesTooLong",
};

/** The label for each of the three states in `LOAN_STATES`. */
export const LOAN_STATE_LABEL_KEYS: Readonly<
  Record<LoanState, LoansPlainMessageKey>
> = {
  active: "stateActive",
  overdue: "stateOverdue",
  returned: "stateReturned",
};
