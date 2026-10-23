import { db } from "@/lib/db";
import type { PhotoVariant } from "@/lib/photo-address";
import type { PhotoContentType } from "@/lib/photo-upload";

/**
 * The photo-storage seam (ADR 0009).
 *
 * **This is the only module in the repository that reads or writes photo
 * bytes.** They live in PostgreSQL, in the `asset_photo_content` side table
 * (`prisma/models/asset.prisma`), one row per photo, and nothing outside this
 * file names that model.
 *
 * One interface, one implementation. The interface is not an environment
 * switch; it exists so that this file stays the single place photo bytes are
 * touched, and so that a test can inject the in-memory fake in
 * `src/lib/storage-fake.ts`. It has two operations and no more:
 *
 * - `writePhotoContent` writes inside a transaction the caller passes in, so a
 *   photo row and its bytes commit or roll back together. A photo without its
 *   bytes, or bytes without their photo, cannot exist.
 * - `readPhotoVariant` reads one variant of one photo, and answers `null` when
 *   the photo does not exist **or its asset is withdrawn**. The visibility
 *   rule is enforced where the data is fetched, not by the route that serves
 *   it, so no caller can forget it.
 *
 * There is no delete operation: the content row cascades from the photo row,
 * so deleting the photo is the delete.
 *
 * Authorisation is not here. Writing is reached only from the upload route
 * and the seed, after their own checks; reading is public by design, because
 * every photo a live asset shows is already on its public scan page.
 */

/**
 * The client Prisma hands an interactive transaction callback, derived from
 * `$transaction` itself — the same derivation
 * `src/app/(app)/assets/activity-writes.ts` uses for the mutations — rather
 * than imported as `Prisma.TransactionClient`, because `src/lib/db.ts` is the
 * only module allowed to import the generated client.
 */
type TransactionCallback = Parameters<typeof db.$transaction>[0];
export type TransactionClient = TransactionCallback extends (
  client: infer Client,
) => unknown
  ? Client
  : never;

/** Both derivatives of one photo, each with the type its bytes were found to
 * be. All four values are required, as all four columns are `NOT NULL`. */
export interface PhotoContent {
  readonly fullBytes: Uint8Array<ArrayBuffer>;
  readonly fullContentType: PhotoContentType;
  readonly thumbBytes: Uint8Array<ArrayBuffer>;
  readonly thumbContentType: PhotoContentType;
}

/** One stored variant, as the serving route answers it. */
export interface StoredPhotoVariant {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

export interface PhotoStorage {
  writePhotoContent(
    tx: TransactionClient,
    photoId: string,
    content: PhotoContent,
  ): Promise<void>;
  readPhotoVariant(
    photoId: string,
    variant: PhotoVariant,
  ): Promise<StoredPhotoVariant | null>;
}

async function writePhotoContent(
  tx: TransactionClient,
  photoId: string,
  content: PhotoContent,
): Promise<void> {
  await tx.assetPhotoContent.create({
    data: {
      photoId,
      fullBytes: content.fullBytes,
      fullContentType: content.fullContentType,
      thumbBytes: content.thumbBytes,
      thumbContentType: content.thumbContentType,
    },
    select: { photoId: true },
  });
}

/** The content row of a photo whose asset is still in the register. A
 * withdrawn asset's photos match nothing, exactly like a photo that never
 * existed, so the two cannot be told apart from outside. */
function liveContentWhere(photoId: string) {
  return { photoId, photo: { asset: { deletedAt: null } } };
}

/**
 * Each variant selects its own two columns and nothing else. PostgreSQL keeps
 * large `bytea` values out of line, so a thumbnail read never reads the full
 * image — but only if the query does not name the full image's column.
 */
async function readFullVariant(
  photoId: string,
): Promise<StoredPhotoVariant | null> {
  const row = await db.assetPhotoContent.findFirst({
    where: liveContentWhere(photoId),
    select: { fullBytes: true, fullContentType: true },
  });
  return row
    ? { bytes: row.fullBytes, contentType: row.fullContentType }
    : null;
}

async function readThumbVariant(
  photoId: string,
): Promise<StoredPhotoVariant | null> {
  const row = await db.assetPhotoContent.findFirst({
    where: liveContentWhere(photoId),
    select: { thumbBytes: true, thumbContentType: true },
  });
  return row
    ? { bytes: row.thumbBytes, contentType: row.thumbContentType }
    : null;
}

function readPhotoVariant(
  photoId: string,
  variant: PhotoVariant,
): Promise<StoredPhotoVariant | null> {
  return variant === "full"
    ? readFullVariant(photoId)
    : readThumbVariant(photoId);
}

const postgresPhotoStorage: PhotoStorage = {
  writePhotoContent,
  readPhotoVariant,
};

/** The one storage implementation. A function rather than a bare export so the
 * shape matches how the other seams are reached, and so a test can replace it
 * with `vi.mock` without touching a caller. */
export function getPhotoStorage(): PhotoStorage {
  return postgresPhotoStorage;
}
