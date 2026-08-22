import {
  writeLoanedActivity,
  writeReturnedActivity,
  type TransactionClient,
} from "@/app/(app)/assets/activity-writes";
import { LOANED_STATUS } from "@/app/(app)/assets/schemas";
import {
  CHECK_OUT_FROM_STATUS,
  refuseCheckOut,
  refuseReturn,
  RETURN_TO_STATUS,
  type CheckOutRefusal,
  type ReturnRefusal,
} from "@/lib/loan-transitions";

import type { CheckOutInput } from "./schemas";

/**
 * Check-out and return, as two functions that take the caller's transaction
 * client (PRD FR-6, issue #15).
 *
 * **The invariant.** An asset is `loaned` if and only if it has an open loan.
 * Nothing sweeps up afterwards to make that true; it is true because these two
 * functions are the only writers of the `loaned` status —
 * `refuseStatusTransition` in `../assets/schemas.ts` locks the asset form out of
 * that status in both directions — and because each of them moves the status
 * and the loan row in one transaction.
 *
 * **The race.** Two people pressing "check out" on the same asset at the same
 * moment both read `active`, so the read-then-refuse below is necessary and not
 * sufficient. The conditional write is what settles it: `updateMany` with
 * `status: "active"` in its `where` compiles to `UPDATE ... WHERE status =
 * 'active'`, and Postgres re-evaluates that predicate after taking the row lock
 * under READ COMMITTED, so exactly one of the two updates reports `count: 1`
 * and the other reports `count: 0`. A count of zero is the refusal. Return is
 * settled the same way, on `returnedAt: null`, which is also what makes a
 * double return impossible rather than merely unlikely.
 *
 * Because at most one writer can move an asset out of `active`, an asset can
 * never accumulate a second open loan — the "iff" holds by construction rather
 * than by inspection.
 *
 * **Why this module takes `tx` rather than reaching for `db`.** Exactly the
 * reason `../assets/activity-writes.ts` does: the loan row, the asset status
 * and the activity row must land together or not at all. `import type` is
 * erased, so nothing here imports the generated Prisma client at runtime, the
 * seam in `src/lib/db.ts` stays intact, and the whole of this file is unit
 * testable against a fake transaction client — including the case where one of
 * the writes throws half way through. `./mutations.ts` is the thin layer that
 * opens the real transaction.
 */

export type LoanFailureReason = CheckOutRefusal | ReturnRefusal;

export type CheckOutResult =
  | { readonly ok: true; readonly loanId: string }
  | { readonly ok: false; readonly reason: LoanFailureReason };

export type ReturnLoanResult =
  | { readonly ok: true; readonly assetId: string }
  | { readonly ok: false; readonly reason: LoanFailureReason };

export interface CheckOutRequest extends CheckOutInput {
  readonly assetId: string;
}

/**
 * Checks an asset out to a borrower: the asset moves to `loaned`, a `Loan` row
 * opens, and a `loaned` activity row is written — all through `tx`.
 *
 * `now` is a parameter rather than a `new Date()` inside, so the due-date rule
 * is decided against one instant for the whole operation and the tests can pin
 * it. Soft-deleted assets are excluded: a withdrawn record is not something to
 * hand to anybody.
 */
export async function checkOutInTransaction(
  tx: TransactionClient,
  request: CheckOutRequest,
  actorId: string,
  now: Date,
): Promise<CheckOutResult> {
  const asset = await tx.asset.findFirst({
    where: { id: request.assetId, deletedAt: null },
    select: { status: true },
  });

  const refusal = refuseCheckOut(asset?.status ?? null, request.dueAt, now);
  if (refusal !== null) {
    return { ok: false, reason: refusal };
  }

  const claimed = await tx.asset.updateMany({
    where: {
      id: request.assetId,
      deletedAt: null,
      status: CHECK_OUT_FROM_STATUS,
    },
    data: { status: LOANED_STATUS },
  });
  if (claimed.count === 0) {
    return { ok: false, reason: "ASSET_ALREADY_LOANED" };
  }

  const loan = await tx.loan.create({
    data: {
      assetId: request.assetId,
      borrowerName: request.borrowerName,
      borrowerEmail: request.borrowerEmail,
      borrowerUnit: request.borrowerUnit,
      dueAt: request.dueAt,
      notes: request.notes,
      handledById: actorId,
    },
    select: { id: true },
  });

  await writeLoanedActivity(tx, request.assetId, actorId, {
    loanId: loan.id,
    dueAt: request.dueAt,
  });

  return { ok: true, loanId: loan.id };
}

/**
 * Records a return: `returnedAt` is stamped, the asset goes back to `active`,
 * and a `returned` activity row is written — all through `tx`.
 *
 * The asset update is unconditional, deliberately. Winning the `returnedAt:
 * null` race is already exclusive, so there is no second writer to guard
 * against, and an asset whose status had somehow drifted away from `loaned` is
 * put back in step here rather than left wrong.
 */
export async function returnInTransaction(
  tx: TransactionClient,
  loanId: string,
  actorId: string,
  now: Date,
): Promise<ReturnLoanResult> {
  const loan = await tx.loan.findUnique({
    where: { id: loanId },
    select: { assetId: true, returnedAt: true },
  });
  // Narrowed here rather than left to `refuseReturn`, which returns a reason
  // and not a type predicate; `refuseReturn` still owns the rule itself.
  if (loan === null) {
    return { ok: false, reason: "LOAN_NOT_FOUND" };
  }

  const refusal = refuseReturn(loan);
  if (refusal !== null) {
    return { ok: false, reason: refusal };
  }

  const closed = await tx.loan.updateMany({
    where: { id: loanId, returnedAt: null },
    data: { returnedAt: now },
  });
  if (closed.count === 0) {
    return { ok: false, reason: "LOAN_ALREADY_RETURNED" };
  }

  await tx.asset.update({
    where: { id: loan.assetId },
    data: { status: RETURN_TO_STATUS },
  });
  await writeReturnedActivity(tx, loan.assetId, actorId, {
    loanId,
    returnedAt: now,
  });

  return { ok: true, assetId: loan.assetId };
}
