import { db } from "@/lib/db";

import {
  checkOutInTransaction,
  returnInTransaction,
  type CheckOutRequest,
  type CheckOutResult,
  type ReturnLoanResult,
} from "./loan-writes";

/**
 * The only two loan mutations, and the only place either of them meets a real
 * database (PRD FR-6, issue #15).
 *
 * There is deliberately nothing here but the transaction boundary. Every rule,
 * every guard and every write lives in `./loan-writes.ts`, which takes the
 * transaction client as a parameter — so "the loan row and the asset status
 * change land together or not at all" is a property of *this* file being three
 * lines long, and any future step added to a check-out is inside the callback
 * by construction rather than by remembering.
 *
 * `now` is passed down rather than read inside the guards, so one operation
 * decides the due-date rule and stamps `returnedAt` against a single instant.
 * `requireUser()` sits one layer up in `./actions.ts`; nothing here is
 * reachable from a browser on its own.
 */

export async function checkOutAsset(
  request: CheckOutRequest,
  actorId: string,
  now: Date = new Date(),
): Promise<CheckOutResult> {
  return db.$transaction(async (tx) =>
    checkOutInTransaction(tx, request, actorId, now),
  );
}

export async function returnLoan(
  loanId: string,
  actorId: string,
  now: Date = new Date(),
): Promise<ReturnLoanResult> {
  return db.$transaction(async (tx) =>
    returnInTransaction(tx, loanId, actorId, now),
  );
}
