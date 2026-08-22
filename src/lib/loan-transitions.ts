import { LOANED_STATUS, type AssetStatus } from "@/app/(app)/assets/schemas";

/**
 * The loan register's transition rules (PRD FR-6, issue #15), as pure
 * predicates: no database, no `next/headers`, no `next-intl`. Everything that
 * decides *whether* a check-out or a return is allowed lives here, so the rules
 * can be unit-tested against a fixed `now` rather than against the clock, and
 * so the mutation layer reads as a list of guarded writes rather than as
 * policy mixed into SQL.
 *
 * `@/app/(app)/assets/schemas` is imported for `LOANED_STATUS` and the
 * `AssetStatus` union rather than restating either. That module sits under the
 * `(app)` route group but is a plain Zod/constants file — it imports `zod` and
 * nothing else — so the direction of the import costs nothing at runtime, and
 * it is the same direction `src/lib/asset-list-query.ts` already takes. A local
 * copy of the string `"loaned"` would be a second definition free to drift from
 * the one `refuseStatusTransition` enforces on the asset form.
 *
 * **Overdue is derived, never stored.** There is no `isOverdue` column and no
 * job that sets one: a loan becomes overdue by the clock passing `dueAt`, and a
 * stored flag would be wrong for every moment between the crossing and the next
 * run of whatever set it.
 */

/** The three buckets a loan falls into, disjoint by construction — a loan is
 * exactly one of these at any instant. The list filter and the badge both read
 * `loanStateOf`, so a row's badge always agrees with the filter that found it. */
export const LOAN_STATES = ["active", "overdue", "returned"] as const;

export type LoanState = (typeof LOAN_STATES)[number];

/** The two columns every rule here reads. Anything wider would drag borrower
 * personal data into a module that has no use for it. */
export interface LoanTiming {
  readonly dueAt: Date;
  readonly returnedAt: Date | null;
}

/** An open loan is one that has not been returned — the same definition
 * `prisma/models/asset.prisma` states on the `Loan` model and
 * `src/lib/asset-visibility.ts` encodes as `OPEN_LOAN_WHERE`. */
export function isLoanOpen(loan: Pick<LoanTiming, "returnedAt">): boolean {
  return loan.returnedAt === null;
}

/**
 * Whether an open loan's due date has passed. A returned loan is never
 * overdue however late it came back: the register's overdue count is a list of
 * items to chase, and an item already back on the shelf is not one of them.
 *
 * The comparison is strict, so a loan is overdue only once `now` is *past*
 * `dueAt` — the instant itself is still on time.
 */
export function isLoanOverdue(loan: LoanTiming, now: Date): boolean {
  return isLoanOpen(loan) && loan.dueAt.getTime() < now.getTime();
}

export function loanStateOf(loan: LoanTiming, now: Date): LoanState {
  if (!isLoanOpen(loan)) {
    return "returned";
  }
  if (isLoanOverdue(loan, now)) {
    return "overdue";
  }
  return "active";
}

/**
 * The one asset status a check-out may start from, and the one it returns to.
 *
 * Restricting check-out to `active` is wider than "an asset already `loaned`
 * cannot be checked out again", and deliberately so. Return resets the asset to
 * `active` unconditionally (FR-6), so checking out a `retired` or `lost` item
 * would launder it back into service the moment it came back — a status change
 * nobody asked for, made by a feature that has no business making it. Refusing
 * at check-out is the only place that hole closes without contradicting the
 * return rule.
 */
export const CHECK_OUT_FROM_STATUS: AssetStatus = "active";
export const RETURN_TO_STATUS: AssetStatus = "active";

export type CheckOutRefusal =
  | "ASSET_NOT_FOUND"
  | "ASSET_ALREADY_LOANED"
  | "ASSET_NOT_AVAILABLE"
  | "DUE_DATE_IN_PAST";

/**
 * Why a check-out is refused, or `null` when it may go ahead.
 *
 * `ASSET_ALREADY_LOANED` is reported before the broader
 * `ASSET_NOT_AVAILABLE` because it is the refusal a user is most likely to
 * meet and the only one with an obvious remedy — record the return first. A
 * `null` status means the asset row was not found (or was soft-deleted), which
 * is a distinct outcome from any status value.
 */
export function refuseCheckOut(
  assetStatus: AssetStatus | null,
  dueAt: Date,
  now: Date,
): CheckOutRefusal | null {
  if (assetStatus === null) {
    return "ASSET_NOT_FOUND";
  }
  if (assetStatus === LOANED_STATUS) {
    return "ASSET_ALREADY_LOANED";
  }
  if (assetStatus !== CHECK_OUT_FROM_STATUS) {
    return "ASSET_NOT_AVAILABLE";
  }
  if (dueAt.getTime() <= now.getTime()) {
    return "DUE_DATE_IN_PAST";
  }
  return null;
}

export type ReturnRefusal = "LOAN_NOT_FOUND" | "LOAN_ALREADY_RETURNED";

/**
 * Why a return is refused, or `null` when it may go ahead. A loan that is
 * already closed is refused rather than silently re-stamped: `returnedAt` is
 * when the item actually came back, and overwriting it with the moment someone
 * pressed the button a second time would quietly falsify the record.
 */
export function refuseReturn(
  loan: Pick<LoanTiming, "returnedAt"> | null,
): ReturnRefusal | null {
  if (loan === null) {
    return "LOAN_NOT_FOUND";
  }
  if (!isLoanOpen(loan)) {
    return "LOAN_ALREADY_RETURNED";
  }
  return null;
}
