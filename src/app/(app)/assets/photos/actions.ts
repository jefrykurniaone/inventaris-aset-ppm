"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { ASSETS_PATH } from "@/lib/paths";
import {
  acceptPhoto,
  buildPhotoObjectPath,
  MAX_PHOTOS_PER_ASSET,
} from "@/lib/photo-upload";
import { requireUser } from "@/lib/require-user";
import { getObjectStorage } from "@/lib/storage";

import {
  failureMessage,
  logPhotoActionError,
  refuse,
  rejectionMessage,
  succeed,
  type PhotoTranslate,
} from "./action-messages";
import { attachStoredPhoto } from "./attach-photo";
import {
  countLivePhotos,
  removePhoto,
  reorderPhotos,
  setPrimaryPhoto,
} from "./mutations";
import {
  photoAttachRequestSchema,
  photoIdRequestSchema,
  photoReorderRequestSchema,
  photoUploadRequestSchema,
  type PhotoActionResult,
  type PhotoUploadRequestResult,
} from "./schemas";
import { discardObjects } from "./storage-steps";

/**
 * Server actions for asset photos (PRD FR-4.1 to FR-4.10).
 *
 * **`requireUser()` is the first statement of every one of them**, and that
 * is the authorisation boundary for the whole feature. Better Auth issues no
 * Supabase JWT, so Storage row-level security cannot see this application's
 * users and a bucket policy written against `auth.uid()` would be decoration
 * (FR-4.10). The buckets refuse writes from the anonymous and authenticated
 * Supabase roles outright; the only way an object reaches them is a signed URL
 * minted below, after the session check has already passed.
 *
 * `requireUser()`, not `requireAdmin()`: FR-1.4 gives `staff` the right to
 * maintain an asset's record, and a photograph is part of that record.
 *
 * The browser compresses before it uploads, and none of that is trusted here.
 * `requestPhotoUploadAction` checks what the client *says* it will send, and
 * `attachPhotoAction` then checks what the bucket *actually holds* before any
 * row is written. The second check is the control; the first only saves a
 * pointless upload.
 */

function assetEditPath(assetId: string): string {
  return `${ASSETS_PATH}/${assetId}/edit`;
}

function revalidateAsset(assetId: string): void {
  revalidatePath(ASSETS_PATH);
  revalidatePath(assetEditPath(assetId));
}

/** Whether the asset can take another photo, as a localised refusal or
 * `null`. Reads the live count so a full asset is refused before the browser
 * spends a compression pass and an upload on a photo that cannot be kept. */
async function refuseWhenNoRoom(
  t: PhotoTranslate,
  assetId: string,
): Promise<string | null> {
  const photoCount = await countLivePhotos(assetId);
  if (photoCount === null) {
    return t("assetNotFound");
  }
  return photoCount >= MAX_PHOTOS_PER_ASSET ? t("limitReached") : null;
}

/**
 * Mints the two signed upload targets one photo needs — the full image and
 * its thumbnail (FR-4.4).
 *
 * The object paths are built here, from the asset id the server looked up and
 * the content type the allowlist accepted, never from anything resembling a
 * file name. A client therefore cannot choose where its bytes land.
 */
export async function requestPhotoUploadAction(
  input: unknown,
): Promise<PhotoUploadRequestResult> {
  await requireUser();
  const t = await getTranslations("AssetPhotos");

  const parsed = photoUploadRequestSchema.safeParse(input);
  if (!parsed.success) {
    return refuse(t("invalidRequest"));
  }
  const request = parsed.data;

  const acceptedFull = acceptPhoto(request);
  if (!acceptedFull.isAccepted) {
    return refuse(rejectionMessage(t, acceptedFull.rejection));
  }
  const acceptedThumbnail = acceptPhoto({
    contentType: request.thumbnailContentType,
    sizeBytes: request.thumbnailSizeBytes,
  });
  if (!acceptedThumbnail.isAccepted) {
    return refuse(rejectionMessage(t, acceptedThumbnail.rejection));
  }

  const noRoom = await refuseWhenNoRoom(t, request.assetId);
  if (noRoom !== null) {
    return refuse(noRoom);
  }

  try {
    const storage = getObjectStorage();
    const [full, thumbnail] = await Promise.all([
      storage.createSignedUploadTarget(
        buildPhotoObjectPath(request.assetId, acceptedFull.contentType),
      ),
      storage.createSignedUploadTarget(
        buildPhotoObjectPath(request.assetId, acceptedThumbnail.contentType),
      ),
    ]);
    return { ok: true, value: { full, thumbnail } };
  } catch (error) {
    logPhotoActionError("requestPhotoUpload", request, error);
    return refuse(t("storageUnavailable"));
  }
}

/**
 * Records an upload that has already landed in the bucket (FR-4.6, FR-4.9).
 * The checks that make this the real control, rather than a restatement of
 * what the client claimed, live in `attach-photo.ts`.
 */
export async function attachPhotoAction(
  input: unknown,
): Promise<PhotoActionResult<undefined>> {
  const user = await requireUser();
  const t = await getTranslations("AssetPhotos");

  const parsed = photoAttachRequestSchema.safeParse(input);
  if (!parsed.success) {
    return refuse(t("invalidRequest"));
  }

  const result = await attachStoredPhoto(t, parsed.data, user.id);
  if (result.ok) {
    revalidateAsset(parsed.data.assetId);
  }
  return result;
}
/**
 * Deletes a photo: the row, its activity entry, and both objects (FR-4.9).
 *
 * The objects go after the transaction has committed, never before. A delete
 * that fails at the bucket leaves an orphaned object, which ADR 0005 accepts
 * and the dev-bucket purge script cleans up; a delete that succeeded before a
 * rolled-back transaction would leave a row pointing at nothing, which is a
 * broken image no script can repair.
 */
export async function deletePhotoAction(
  input: unknown,
): Promise<PhotoActionResult<undefined>> {
  const user = await requireUser();
  const t = await getTranslations("AssetPhotos");

  const parsed = photoIdRequestSchema.safeParse(input);
  if (!parsed.success) {
    return refuse(t("invalidRequest"));
  }
  const { assetId, photoId } = parsed.data;

  const result = await removePhoto(assetId, photoId, user.id);
  if (!result.ok) {
    return refuse(failureMessage(t, result.reason));
  }

  await discardObjects(result.value.objectPaths);
  revalidateAsset(assetId);
  return succeed();
}

/** Promotes one photo to primary, demoting the previous one in the same
 * transaction (FR-4.1). */
export async function setPrimaryPhotoAction(
  input: unknown,
): Promise<PhotoActionResult<undefined>> {
  await requireUser();
  const t = await getTranslations("AssetPhotos");

  const parsed = photoIdRequestSchema.safeParse(input);
  if (!parsed.success) {
    return refuse(t("invalidRequest"));
  }
  const { assetId, photoId } = parsed.data;

  const result = await setPrimaryPhoto(assetId, photoId);
  if (!result.ok) {
    return refuse(failureMessage(t, result.reason));
  }

  revalidateAsset(assetId);
  return succeed();
}

/** Rewrites the display order of an asset's photos (FR-4.1). */
export async function reorderPhotosAction(
  input: unknown,
): Promise<PhotoActionResult<undefined>> {
  await requireUser();
  const t = await getTranslations("AssetPhotos");

  const parsed = photoReorderRequestSchema.safeParse(input);
  if (!parsed.success) {
    return refuse(t("invalidRequest"));
  }
  const { assetId, photoIds } = parsed.data;

  const result = await reorderPhotos(assetId, photoIds);
  if (!result.ok) {
    return refuse(failureMessage(t, result.reason));
  }

  revalidateAsset(assetId);
  return succeed();
}
