import {
  checkOutInTransaction,
  returnInTransaction,
} from "@/app/(app)/loans/loan-writes";
import { db } from "@/lib/db";
import type { SeedAssetPlanItem } from "@/lib/seed-asset-mix";
import { loanTimingFor } from "@/lib/seed-loan-dates";

import { SEED_BORROWER_BY_ROLE } from "./borrowers";

/**
 * Writing the five demonstration loans (issue #16) through the real
 * transaction functions in `src/app/(app)/loans/loan-writes.ts` — never by
 * hand-writing a `Loan` row, so the "an asset is `loaned` iff it has an open
 * loan" invariant that module documents holds for these rows too.
 *
 * Idempotency is "does this asset already have a loan row" rather than a
 * natural key of its own: only this seed ever loans out these five assets
 * (they are otherwise ordinary catalog entries), so a rerun that finds any
 * loan already there is a rerun that already did this step.
 */

export interface SeedLoanWriteInput {
  readonly assetIdBySeedKey: ReadonlyMap<string, string>;
  readonly planBySeedKey: ReadonlyMap<string, SeedAssetPlanItem>;
  /** The two demonstration staff accounts, cycled through by loan index so
   * the register shows more than one handler — a directorate of one person
   * would not look like a real one. */
  readonly actorIds: readonly string[];
}

function loanSubjects(
  planBySeedKey: ReadonlyMap<string, SeedAssetPlanItem>,
): readonly SeedAssetPlanItem[] {
  return [...planBySeedKey.values()].filter((item) => item.loanRole !== null);
}

async function hasExistingLoan(assetId: string): Promise<boolean> {
  const existing = await db.loan.findFirst({
    where: { assetId },
    select: { id: true },
  });
  return existing !== null;
}

async function returnLoan(
  loanId: string,
  actorId: string,
  returnNow: Date,
): Promise<void> {
  const result = await db.$transaction((tx) =>
    returnInTransaction(tx, loanId, actorId, returnNow),
  );
  if (!result.ok) {
    throw new Error(
      `prisma/seed-data/loan-writer: could not return loan "${loanId}": ${result.reason}.`,
    );
  }
}

/**
 * Opens one demonstration loan and back-dates `checkedOutAt` to match its
 * role's timing, then returns it too when the role calls for that.
 *
 * `checkedOutAt` cannot be passed through `checkOutInTransaction`: the
 * column defaults to the database's own `now()` at insert time
 * (`prisma/models/asset.prisma`), precisely so an ordinary check-out always
 * records the real moment it happened. A demonstration loan is the one
 * sanctioned exception — "this loan opened twenty days ago" cannot be
 * expressed through the mutation at all, so the direct write below is how
 * that history is recorded.
 */
async function openLoan(
  item: SeedAssetPlanItem,
  role: NonNullable<SeedAssetPlanItem["loanRole"]>,
  assetId: string,
  actorId: string,
  now: Date,
): Promise<string> {
  const borrower = SEED_BORROWER_BY_ROLE[role];
  const timing = loanTimingFor(role, now);

  const result = await db.$transaction((tx) =>
    checkOutInTransaction(
      tx,
      {
        assetId,
        borrowerName: borrower.borrowerName,
        borrowerEmail: borrower.borrowerEmail,
        borrowerUnit: borrower.borrowerUnit,
        dueAt: timing.dueAt,
        notes: borrower.notes,
      },
      actorId,
      timing.checkOutNow,
    ),
  );
  if (!result.ok) {
    throw new Error(
      `prisma/seed-data/loan-writer: could not check out "${item.seedKey}" (${role}): ${result.reason}.`,
    );
  }

  await db.loan.update({
    where: { id: result.loanId },
    data: { checkedOutAt: timing.checkedOutAt },
  });

  if (timing.returned !== null) {
    await returnLoan(result.loanId, actorId, timing.returned.returnNow);
  }
  return timing.returned !== null
    ? `opened and returned loan for "${item.seedKey}" (${role}).`
    : `opened loan for "${item.seedKey}" (${role}).`;
}

export async function seedLoans(
  input: SeedLoanWriteInput,
): Promise<readonly string[]> {
  const now = new Date();
  const messages: string[] = [];

  for (const [index, item] of loanSubjects(input.planBySeedKey).entries()) {
    const assetId = input.assetIdBySeedKey.get(item.seedKey);
    const role = item.loanRole;
    if (!assetId || !role) {
      throw new Error(
        `prisma/seed-data/loan-writer: no asset id resolved for "${item.seedKey}".`,
      );
    }
    if (await hasExistingLoan(assetId)) {
      messages.push(
        `loan for "${item.seedKey}" already exists; nothing changed.`,
      );
      continue;
    }
    const actorId = input.actorIds[index % input.actorIds.length];
    messages.push(await openLoan(item, role, assetId, actorId, now));
  }

  return messages;
}
