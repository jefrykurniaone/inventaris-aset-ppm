import { acceptPhoto, isPhotoObjectPathFor } from "@/lib/photo-upload";

import {
  failureMessage,
  logPhotoActionError,
  refuse,
  rejectionMessage,
  succeed,
  type PhotoTranslate,
} from "./action-messages";
import { insertPhoto } from "./mutations";
import type { PhotoActionResult, PhotoAttachRequest } from "./schemas";
import {
  discardObjects,
  statBothObjects,
  type StoredPair,
} from "./storage-steps";

/**
 * Recording an upload that has already landed in the bucket (PRD FR-4.6,
 * FR-4.9).
 *
 * **This is where the size cap and the content-type allowlist are actually
 * enforced.** Everything the browser said at mint time was a claim about a
 * file the server had never seen; what is checked here is what `statObject`
 * reports the bucket is holding. A caller that skipped the compression step,
 * lied about the type, or uploaded something else entirely to the URL it was
 * given is refused, and its objects are removed.
 *
 * Split out of `actions.ts` so both files stay inside the project's 300-line
 * limit, and because a `"use server"` module may export only async functions.
 */

/** Whether both paths are ones this application could have minted for this
 * asset. Without it, a caller with a valid session could name any object in
 * the bucket — another asset's photo included — and have the server stat it,
 * store it, or delete it. */
function isOwnedByAsset(request: PhotoAttachRequest): boolean {
  return [request.objectPath, request.thumbnailObjectPath].every((objectPath) =>
    isPhotoObjectPathFor(request.assetId, objectPath),
  );
}

/** Refuses a stored pair whose real bytes break the allowlist or the cap, and
 * removes both objects when it does — nothing that will never own a row is
 * left in the bucket. */
async function refuseUnacceptableObjects(
  t: PhotoTranslate,
  stored: StoredPair,
): Promise<string | null> {
  const refused = [stored.full, stored.thumbnail]
    .map((entry) => acceptPhoto(entry.object))
    .find((acceptance) => !acceptance.isAccepted);
  if (!refused || refused.isAccepted) {
    return null;
  }
  await discardObjects([stored.full.objectPath, stored.thumbnail.objectPath]);
  return rejectionMessage(t, refused.rejection);
}

async function persistPhoto(
  t: PhotoTranslate,
  request: PhotoAttachRequest,
  stored: StoredPair,
  actorId: string,
): Promise<PhotoActionResult<undefined>> {
  const result = await insertPhoto({
    assetId: request.assetId,
    actorId,
    objectPath: stored.full.objectPath,
    thumbObjectPath: stored.thumbnail.objectPath,
    width: request.width,
    height: request.height,
    sizeBytes: stored.full.object.sizeBytes,
  });

  if (!result.ok) {
    await discardObjects([stored.full.objectPath, stored.thumbnail.objectPath]);
    return refuse(failureMessage(t, result.reason));
  }
  return succeed();
}

export async function attachStoredPhoto(
  t: PhotoTranslate,
  request: PhotoAttachRequest,
  actorId: string,
): Promise<PhotoActionResult<undefined>> {
  if (!isOwnedByAsset(request)) {
    logPhotoActionError(
      "attachPhoto",
      request,
      "object path is not this asset's",
    );
    return refuse(t("invalidRequest"));
  }

  try {
    const stored = await statBothObjects(request);
    if (stored === null) {
      return refuse(t("uploadIncomplete"));
    }

    const unacceptable = await refuseUnacceptableObjects(t, stored);
    if (unacceptable !== null) {
      return refuse(unacceptable);
    }

    return await persistPhoto(t, request, stored, actorId);
  } catch (error) {
    logPhotoActionError("attachPhoto", request, error);
    return refuse(t("storageUnavailable"));
  }
}
