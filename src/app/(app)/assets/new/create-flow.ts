import type { RunPhotoUploadResult } from "../photos/run-photo-upload";
import type { AssetFormState } from "../schemas";

/**
 * What the create page does next, at each of the two points where the
 * create-with-a-photo flow can branch (issue #85).
 *
 * Creating an asset that carries its first photo is two writes, not one: the
 * row goes in through a server action, and only then can the browser upload,
 * because a photo object path is keyed by the asset id. The rule that matters
 * is that the second write failing never undoes the first — a photo that does
 * not reach storage leaves a perfectly good asset behind, and the user is
 * told so and pointed at its edit page.
 *
 * Kept as plain functions, apart from the hook that calls them, so that rule
 * is stated in one place and can be tested without React, a network, or a
 * bucket.
 */

/** The branch taken once the create action has answered. */
export type CreateStep =
  /** The submission was refused; the form re-renders with its errors. */
  | { readonly kind: "rejected" }
  /** The asset exists and there is no photo to attach. */
  | { readonly kind: "navigate"; readonly assetId: string }
  /** The asset exists and its first photo is ready to upload. */
  | { readonly kind: "upload"; readonly assetId: string; readonly photo: File };

/** An asset that was created while its first photo was not stored. `reason`
 * is the localised explanation, or `null` when the user cancelled the upload
 * — an outcome rather than a failure, and nothing to put on the screen. */
export interface PhotoFailure {
  readonly assetId: string;
  readonly reason: string | null;
}

/** The branch taken once the upload pipeline has answered. */
export type PhotoStep =
  | { readonly kind: "navigate" }
  | { readonly kind: "failed"; readonly failure: PhotoFailure };

/**
 * Reads the create action's answer.
 *
 * A state that claims success without an id is treated as a rejection rather
 * than followed: there would be nothing to key an object path on, and
 * uploading against a guessed id is exactly what `attachStoredPhoto` refuses.
 */
export function nextCreateStep(
  state: AssetFormState,
  photo: File | null,
): CreateStep {
  const assetId = state.createdAssetId;
  if (!state.isSuccess || assetId === undefined) {
    return { kind: "rejected" };
  }
  if (photo === null) {
    return { kind: "navigate", assetId };
  }
  return { kind: "upload", assetId, photo };
}

/** Reads the upload pipeline's answer. The asset id is carried into the
 * failure so the notice can link straight to the page the photo can be added
 * from — the created asset is never lost, only its photo. */
export function nextPhotoStep(
  assetId: string,
  result: RunPhotoUploadResult,
): PhotoStep {
  if (result.ok) {
    return { kind: "navigate" };
  }
  return { kind: "failed", failure: { assetId, reason: result.message } };
}
