import {
  ASSET_CODE_LOCK_NAMESPACE,
  assetCodeLockKey,
  assetCodeNamespacePrefix,
  formatAssetCode,
  nextAssetCodeSequence,
} from "@/lib/asset-code";
import { db } from "@/lib/db";
import {
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";
import { generateQrToken } from "@/lib/qr-token";

import { diffAssets, toComparableAsset } from "./activity";
import {
  writeCreatedActivity,
  writeDeletedActivity,
  writeUpdateActivities,
  type TransactionClient,
} from "./activity-writes";
import { LOANED_STATUS, type AssetInput } from "./schemas";

/**
 * Plain database logic for the asset register (PRD FR-2.1 to FR-2.5), kept
 * apart from `actions.ts` so nothing here touches `next/headers` — every
 * function is a plain `async` function with no Next.js request context, which
 * is what lets `scripts/verify-asset-code-concurrency.ts` drive `createAsset`
 * directly against the real development database. The `requireUser()`
 * authorisation boundary lives one layer up, in `actions.ts`; nothing in this
 * file is reachable from a browser on its own.
 */

export type MutationFailureReason =
  | "NOT_FOUND"
  | "INVALID_CATEGORY"
  | "INVALID_REFERENCE"
  | "SEQUENCE_EXHAUSTED"
  | "CODE_COLLISION"
  | "STATUS_LOCKED_BY_LOAN";

export type MutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: MutationFailureReason };

export type CreateAssetResult =
  | { readonly ok: true; readonly assetId: string; readonly assetCode: string }
  | { readonly ok: false; readonly reason: MutationFailureReason };

const OK: MutationResult = { ok: true };

/**
 * How many times a create is retried after the `Asset.assetCode` unique index
 * refuses it. Three, not one: the advisory lock already serialises the
 * common case, so a rejection here means either the astronomically unlikely
 * `qrToken` collision or a code issued by a writer that did not take the lock
 * — a seed script, a psql session. Both clear on the next read.
 */
const MAX_CREATE_ATTEMPTS = 3;

interface IssuedCode {
  readonly ok: true;
  readonly assetCode: string;
}

type IssueCodeResult =
  IssuedCode | { readonly ok: false; readonly reason: MutationFailureReason };

/**
 * Issues the next asset code for one (category, acquisition year) namespace,
 * inside the caller's transaction.
 *
 * `pg_advisory_xact_lock` is what makes two simultaneous creates safe, and it
 * is transaction-scoped rather than session-scoped on purpose: Postgres
 * releases it at commit or rollback, so it is correct behind Supabase's
 * transaction pooler, where a session-scoped lock could outlive the pooled
 * connection's association with this request and never be released. It costs
 * no schema change — the alternative, a counter table, is a new model and a
 * new migration, and issue #21 reserves the application schema for #3.
 *
 * The namespace is read off `assetCode` itself, not off the `categoryId` and
 * `acquisitionYear` columns. Those two stay editable after creation while the
 * code does not follow them, so a row moved to another category would free
 * its old sequence for reuse and the unique index would then reject the next
 * create. The prefix is the only definition of the namespace that cannot go
 * stale. Soft-deleted rows are included, deliberately: a printed label
 * outlives the row, so its number is never handed out again.
 */
async function issueAssetCode(
  tx: TransactionClient,
  categoryId: string,
  acquisitionYear: number,
): Promise<IssueCodeResult> {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { code: true },
  });
  if (!category) {
    return { ok: false, reason: "INVALID_CATEGORY" };
  }

  // `$executeRaw`, not `$queryRaw`: `pg_advisory_xact_lock` returns `void`,
  // and Prisma cannot deserialise a `void` column — `$queryRaw` fails with
  // "Failed to deserialize column of type 'void'". Nothing is read back here
  // anyway; the call blocks until the lock is held.
  const lockKey = assetCodeLockKey(categoryId, acquisitionYear);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ASSET_CODE_LOCK_NAMESPACE}::int4, ${lockKey}::int4)`;

  const prefix = assetCodeNamespacePrefix(category.code, acquisitionYear);
  const issued = await tx.asset.findMany({
    where: { assetCode: { startsWith: prefix } },
    select: { assetCode: true },
  });

  const sequence = nextAssetCodeSequence(issued.map((row) => row.assetCode));
  if (sequence === null) {
    return { ok: false, reason: "SEQUENCE_EXHAUSTED" };
  }

  return {
    ok: true,
    assetCode: formatAssetCode({
      categoryCode: category.code,
      acquisitionYear,
      sequence,
    }),
  };
}

async function createAssetOnce(
  input: AssetInput,
  actorId: string,
): Promise<CreateAssetResult> {
  return db.$transaction(async (tx) => {
    const issued = await issueAssetCode(
      tx,
      input.categoryId,
      input.acquisitionYear,
    );
    if (!issued.ok) {
      return issued;
    }

    const asset = await tx.asset.create({
      data: {
        ...input,
        assetCode: issued.assetCode,
        qrToken: generateQrToken(),
        createdById: actorId,
      },
      select: { id: true, assetCode: true },
    });

    await writeCreatedActivity(tx, asset.id, actorId, asset.assetCode);

    return { ok: true, assetId: asset.id, assetCode: asset.assetCode };
  });
}

/** Classifies a thrown create failure, rethrowing anything that is not one of
 * the two constraint violations this path is allowed to absorb — an unknown
 * error must not be flattened into a localised "try again". */
function classifyCreateError(error: unknown): "RETRY" | MutationFailureReason {
  if (isUniqueConstraintError(error)) {
    return "RETRY";
  }
  if (isForeignKeyConstraintError(error)) {
    return "INVALID_REFERENCE";
  }
  throw error;
}

/**
 * Creates an asset, generating both identifiers (PRD FR-2.1, FR-2.2) and
 * writing the `created` activity row in the same transaction, so an asset
 * never exists without its own audit trail entry.
 */
export async function createAsset(
  input: AssetInput,
  actorId: string,
): Promise<CreateAssetResult> {
  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    try {
      return await createAssetOnce(input, actorId);
    } catch (error) {
      const classified = classifyCreateError(error);
      if (classified !== "RETRY") {
        return { ok: false, reason: classified };
      }
    }
  }
  return { ok: false, reason: "CODE_COLLISION" };
}

/**
 * Updates an asset. `assetCode` and `qrToken` are never regenerated, even
 * when the category or the acquisition year changes — see the comment on
 * `findAssetForEdit` in `queries.ts`.
 *
 * The one refused transition is away from `loaned`: the loan register (#15)
 * owns that, and letting the asset form quietly mark a checked-out item
 * `retired` would strand the open loan row.
 */
export async function updateAsset(
  id: string,
  input: AssetInput,
  actorId: string,
): Promise<MutationResult> {
  const existing = await db.asset.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    return { ok: false, reason: "NOT_FOUND" };
  }
  if (existing.status === LOANED_STATUS && input.status !== LOANED_STATUS) {
    return { ok: false, reason: "STATUS_LOCKED_BY_LOAN" };
  }

  const changes = diffAssets(
    toComparableAsset(existing),
    toComparableAsset(input),
  );

  try {
    await db.$transaction(async (tx) => {
      await tx.asset.update({ where: { id }, data: input });
      await writeUpdateActivities(tx, id, actorId, changes);
    });
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      return { ok: false, reason: "INVALID_REFERENCE" };
    }
    throw error;
  }

  return OK;
}

/**
 * Soft delete (PRD FR-2.5): the row keeps its `assetCode` and `qrToken`, so a
 * label already stuck to a retired item still resolves to a "record
 * withdrawn" page rather than a 404 (#11). The `deletedAt: null` guard means
 * a double submission writes one `deleted` activity row, not two.
 */
export async function softDeleteAsset(
  id: string,
  actorId: string,
): Promise<MutationResult> {
  return db.$transaction(async (tx) => {
    const existing = await tx.asset.findFirst({
      where: { id, deletedAt: null },
      select: { assetCode: true },
    });
    if (!existing) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    await tx.asset.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeDeletedActivity(tx, id, actorId, existing.assetCode);

    return OK;
  });
}
