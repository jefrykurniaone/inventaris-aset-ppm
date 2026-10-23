"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { ASSETS_PATH } from "@/lib/paths";
import { requireUser } from "@/lib/require-user";

import { failureMessage, refuse, succeed } from "./action-messages";
import { removePhoto, reorderPhotos, setPrimaryPhoto } from "./mutations";
import {
  photoIdRequestSchema,
  photoReorderRequestSchema,
  type PhotoActionResult,
} from "./schemas";

/**
 * Server actions for managing an asset's photos (PRD FR-4.1, FR-4.9).
 *
 * **`requireUser()` is the first statement of every one of them**, and that
 * is the authorisation boundary for these three operations. `requireUser()`,
 * not `requireAdmin()`: FR-1.4 gives `staff` the right to maintain an asset's
 * record, and a photograph is part of that record.
 *
 * Adding a photo is not here. It goes through the route handler at
 * `src/app/api/assets/[id]/photos/route.ts` (ADR 0009), because a server
 * action offers the browser neither upload progress nor cancellation, and
 * raising the server-action body limit for one photo would raise it for every
 * action. That route applies the same session rule.
 */

function assetEditPath(assetId: string): string {
  return `${ASSETS_PATH}/${assetId}/edit`;
}

function revalidateAsset(assetId: string): void {
  revalidatePath(ASSETS_PATH);
  revalidatePath(assetEditPath(assetId));
}

/**
 * Deletes a photo: the row, its bytes and an activity entry, in one
 * transaction (FR-4.9). There is no storage call here — the bytes cascade
 * from the row (ADR 0009), so a deleted photo's address answers 404 as soon
 * as the transaction commits.
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
