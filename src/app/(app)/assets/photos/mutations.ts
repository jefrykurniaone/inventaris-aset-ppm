import { db } from "@/lib/db";
import { MAX_PHOTOS_PER_ASSET } from "@/lib/photo-upload";
import { getPhotoStorage, type PhotoContent } from "@/lib/storage";

import type { TransactionClient } from "../activity-writes";

/**
 * Plain database logic for asset photos (PRD FR-4.1, FR-4.9; ADR 0009), kept
 * apart from `actions.ts` and from the upload route so nothing here touches
 * `next/headers` — the same split `src/app/(app)/assets/mutations.ts` makes,
 * and for the same reason: these functions are callable from a plain script,
 * which is what the seed relies on. The session check lives one layer up, in
 * the server actions and in `src/app/api/assets/[id]/photos/route.ts`.
 *
 * A photo's bytes are written through `src/lib/storage.ts` inside the same
 * transaction as its row, and removed by the cascade when the row is deleted,
 * so there is no moment at which one exists without the other.
 */

export type PhotoFailureReason = "NOT_FOUND" | "LIMIT_REACHED";

export type PhotoMutationResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly reason: PhotoFailureReason };

export interface InsertPhotoInput {
  readonly assetId: string;
  readonly actorId: string;
  readonly width: number;
  readonly height: number;
  /** Both derivatives, already identified from their bytes by the caller. */
  readonly content: PhotoContent;
}

/**
 * Locks one live asset row for the rest of the transaction and reports
 * whether it exists.
 *
 * `SELECT … FOR UPDATE` rather than an application-level count check: two
 * uploads finishing at the same moment would otherwise both read four photos
 * and both insert a fifth, and "a sixth photo is rejected server-side" would
 * hold only when nobody tested it concurrently. Postgres serialises the second
 * transaction behind the first here, so the count it reads is the committed
 * one. A row lock, not an advisory lock, because the row already exists and
 * needs to be checked for `deletedAt` in the same round trip.
 */
async function lockLiveAsset(
  tx: TransactionClient,
  assetId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<
    ReadonlyArray<{ id: string }>
  >`SELECT "id" FROM "asset" WHERE "id" = ${assetId} AND "deletedAt" IS NULL FOR UPDATE`;
  return rows.length > 0;
}

/**
 * Inserts one photo row, its bytes and its `photo_added` activity entry in one
 * transaction (FR-4.1, FR-8.3; ADR 0009).
 *
 * `sizeBytes` is measured here from the bytes being stored, never taken from a
 * caller's claim. The first photo of an asset becomes the primary, because
 * FR-4.1 says *exactly* one is primary and an asset with photos and no primary
 * would render no image in any list. The activity payload records the photo
 * id and nothing else.
 */
export async function insertPhoto(
  input: InsertPhotoInput,
): Promise<PhotoMutationResult<{ readonly photoId: string }>> {
  return db.$transaction(async (tx) => {
    if (!(await lockLiveAsset(tx, input.assetId))) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    const existingCount = await tx.assetPhoto.count({
      where: { assetId: input.assetId },
    });
    if (existingCount >= MAX_PHOTOS_PER_ASSET) {
      return { ok: false, reason: "LIMIT_REACHED" };
    }

    const photo = await tx.assetPhoto.create({
      data: {
        assetId: input.assetId,
        width: input.width,
        height: input.height,
        sizeBytes: input.content.fullBytes.length,
        isPrimary: existingCount === 0,
        sortOrder: existingCount,
        uploadedById: input.actorId,
      },
      select: { id: true },
    });
    await getPhotoStorage().writePhotoContent(tx, photo.id, input.content);

    await tx.assetActivity.create({
      data: {
        assetId: input.assetId,
        actorId: input.actorId,
        type: "photo_added",
        payload: { photoId: photo.id },
      },
    });

    return { ok: true, value: { photoId: photo.id } };
  });
}

/** Hands the primary flag to the oldest remaining photo after the primary one
 * was deleted, so an asset with photos always has exactly one. */
async function promoteFallbackPrimary(
  tx: TransactionClient,
  assetId: string,
): Promise<void> {
  const next = await tx.assetPhoto.findFirst({
    where: { assetId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (next) {
    await tx.assetPhoto.update({
      where: { id: next.id },
      data: { isPrimary: true },
    });
  }
}

/**
 * Deletes one photo row and writes `photo_removed` (FR-4.9).
 *
 * The photo's bytes go with the row: `asset_photo_content` cascades from it
 * (ADR 0009), so the delete is one statement and leaves nothing to clean up,
 * and the serving route answers 404 for the photo as soon as this commits.
 *
 * `assetId` is a parameter as well as `photoId` so the delete is scoped to the
 * asset the caller claims to be editing; a photo id belonging to a different
 * asset finds nothing rather than deleting someone else's row.
 */
export async function removePhoto(
  assetId: string,
  photoId: string,
  actorId: string,
): Promise<PhotoMutationResult<undefined>> {
  return db.$transaction(async (tx) => {
    const photo = await tx.assetPhoto.findFirst({
      where: { id: photoId, assetId },
      select: { id: true, isPrimary: true },
    });
    if (!photo) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    await tx.assetPhoto.delete({ where: { id: photo.id } });
    if (photo.isPrimary) {
      await promoteFallbackPrimary(tx, assetId);
    }

    await tx.assetActivity.create({
      data: {
        assetId,
        actorId,
        type: "photo_removed",
        payload: { photoId: photo.id },
      },
    });

    return { ok: true, value: undefined };
  });
}

/**
 * Makes one photo the primary (FR-4.1).
 *
 * Demote-then-promote inside one transaction. The "at most one primary" rule
 * is a partial unique index in Postgres (see `prisma/models/asset.prisma`),
 * checked per statement, so this order passes through a moment with zero
 * primaries and never through one with two. The reverse order would be
 * rejected by the index rather than merely being racy.
 */
export async function setPrimaryPhoto(
  assetId: string,
  photoId: string,
): Promise<PhotoMutationResult<undefined>> {
  return db.$transaction(async (tx) => {
    const photo = await tx.assetPhoto.findFirst({
      where: { id: photoId, assetId },
      select: { id: true },
    });
    if (!photo) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    await tx.assetPhoto.updateMany({
      where: { assetId, isPrimary: true },
      data: { isPrimary: false },
    });
    await tx.assetPhoto.update({
      where: { id: photo.id },
      data: { isPrimary: true },
    });

    return { ok: true, value: undefined };
  });
}

/**
 * Rewrites `sortOrder` to match the given order (FR-4.1).
 *
 * The submitted list has to be exactly the asset's photos — not a subset and
 * not a set with something else mixed in — or the result would be a partial
 * reordering with duplicate positions. The whole list is compared rather than
 * only counted, because a list of the right length made of one repeated id
 * would otherwise pass.
 */
export async function reorderPhotos(
  assetId: string,
  photoIds: readonly string[],
): Promise<PhotoMutationResult<undefined>> {
  return db.$transaction(async (tx) => {
    const stored = await tx.assetPhoto.findMany({
      where: { assetId },
      select: { id: true },
    });
    const storedIds = new Set(stored.map((photo) => photo.id));
    const submittedIds = new Set(photoIds);
    const isSameSet =
      submittedIds.size === photoIds.length &&
      storedIds.size === submittedIds.size &&
      photoIds.every((photoId) => storedIds.has(photoId));
    if (!isSameSet) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    for (const [index, photoId] of photoIds.entries()) {
      await tx.assetPhoto.update({
        where: { id: photoId },
        data: { sortOrder: index },
      });
    }

    return { ok: true, value: undefined };
  });
}
