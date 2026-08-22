import { getObjectStorage, type StoredObject } from "@/lib/storage";

import { logPhotoActionError } from "./action-messages";

/**
 * The two things the photo actions do with object storage that are worth
 * naming: read back what actually landed, and throw away what must not be
 * kept.
 *
 * Split out of `actions.ts` so that file stays inside the size limit, and
 * because `"use server"` may export only async functions — the types below
 * could not live there.
 */

export interface StoredEntry {
  readonly objectPath: string;
  readonly object: StoredObject;
}

export interface StoredPair {
  readonly full: StoredEntry;
  readonly thumbnail: StoredEntry;
}

export interface UploadedPaths {
  readonly objectPath: string;
  readonly thumbnailObjectPath: string;
}

/**
 * Reads back both objects the browser says it uploaded, or `null` when either
 * is missing.
 *
 * A missing object is the ordinary outcome of an upload that failed halfway,
 * and it is also what a caller inventing a path would see. Both end the same
 * way — no row is written — so they need no separate handling here.
 */
export async function statBothObjects(
  paths: UploadedPaths,
): Promise<StoredPair | null> {
  const storage = getObjectStorage();
  const [full, thumbnail] = await Promise.all([
    storage.statObject(paths.objectPath),
    storage.statObject(paths.thumbnailObjectPath),
  ]);

  if (!full || !thumbnail) {
    return null;
  }
  return {
    full: { objectPath: paths.objectPath, object: full },
    thumbnail: { objectPath: paths.thumbnailObjectPath, object: thumbnail },
  };
}

/**
 * Removes objects that must not be kept, and never throws.
 *
 * Every caller is already on a failure path or has already committed a
 * deletion, so a second failure here must not replace the outcome the user is
 * waiting on. What it leaves behind is an orphaned object, which ADR 0005
 * accepts explicitly and `npm run storage:purge:dev` clears. The failure is
 * logged with its paths so it is visible rather than silent — this is not an
 * empty catch.
 */
export async function discardObjects(
  objectPaths: readonly string[],
): Promise<void> {
  try {
    await getObjectStorage().deleteObjects(objectPaths);
  } catch (error) {
    logPhotoActionError("discardObjects", objectPaths, error);
  }
}
