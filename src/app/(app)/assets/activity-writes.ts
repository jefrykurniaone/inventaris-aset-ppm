import type { db } from "@/lib/db";

import {
  hasChanges,
  splitStatusChange,
  type AssetChanges,
  type AssetFieldChange,
} from "./activity";

/**
 * Writing the append-only audit trail (PRD FR-8.3).
 *
 * Every writer here takes the caller's transaction client rather than `db`,
 * so an activity row is committed with the mutation it describes or not at
 * all — an asset that exists with no `created` row, or a soft delete with no
 * `deleted` row, would be a hole in the trail that nothing later can fill.
 *
 * Separate from `mutations.ts` so neither file passes the project's 300-line
 * limit, and separate from `activity.ts` so the diff rules there stay pure
 * and free of any database dependency.
 */

/**
 * The client Prisma hands an interactive transaction callback, derived from
 * `$transaction` itself rather than imported as `Prisma.TransactionClient`:
 * `src/lib/db.ts` is the only module allowed to import the generated client
 * (CLAUDE.md), and inferring the type keeps these helpers sharing one
 * transaction without breaching that seam. The `import type` above is erased,
 * so this module adds no runtime import of `db` either.
 */
type TransactionCallback = Parameters<typeof db.$transaction>[0];
export type TransactionClient = TransactionCallback extends (
  client: infer Client,
) => unknown
  ? Client
  : never;

/** The `created` payload names the identifier the trail is read by, not the
 * eighteen fields the row was created with — those are the row itself. */
export async function writeCreatedActivity(
  tx: TransactionClient,
  assetId: string,
  actorId: string,
  assetCode: string,
): Promise<void> {
  await tx.assetActivity.create({
    data: { assetId, actorId, type: "created", payload: { assetCode } },
  });
}

export async function writeDeletedActivity(
  tx: TransactionClient,
  assetId: string,
  actorId: string,
  assetCode: string,
): Promise<void> {
  await tx.assetActivity.create({
    data: { assetId, actorId, type: "deleted", payload: { assetCode } },
  });
}

async function writeStatusActivity(
  tx: TransactionClient,
  assetId: string,
  actorId: string,
  change: AssetFieldChange,
): Promise<void> {
  await tx.assetActivity.create({
    data: {
      assetId,
      actorId,
      type: "status_changed",
      payload: { from: change.from, to: change.to },
    },
  });
}

/**
 * Writes what one edit changed: a `status_changed` row for the transition, an
 * `updated` row carrying the remaining fields with their before and after
 * values, or both, or — when the submission repeated the stored row exactly —
 * neither. A no-op edit leaves no entry, because "someone pressed Save" is
 * not an event the trail exists to record.
 */
export async function writeUpdateActivities(
  tx: TransactionClient,
  assetId: string,
  actorId: string,
  changes: AssetChanges,
): Promise<void> {
  const { statusChange, otherChanges } = splitStatusChange(changes);

  if (statusChange !== null) {
    await writeStatusActivity(tx, assetId, actorId, statusChange);
  }
  if (hasChanges(otherChanges)) {
    await tx.assetActivity.create({
      data: {
        assetId,
        actorId,
        type: "updated",
        payload: { changes: otherChanges },
      },
    });
  }
}
