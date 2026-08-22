import type { getTranslations } from "next-intl/server";

import { createActionErrorLogger } from "@/lib/log-error";
import type { PhotoRejection } from "@/lib/photo-upload";

import type { PhotoFailureReason } from "./mutations";
import type { PhotoActionResult } from "./schemas";

/**
 * Turning a refusal into something a user can read.
 *
 * Separate from `actions.ts` so that file stays inside the project's size
 * limit and so that a `"use server"` module — which may export only async
 * functions — is not the place these synchronous helpers live.
 *
 * Every message goes through `next-intl`, including the ones nobody expects
 * to see: an unexpected failure still gets a localised sentence rather than
 * an error string, because `CLAUDE.md` forbids internal error text reaching a
 * user, and an untranslated fallback is exactly how that leaks.
 */

export type PhotoTranslate = Awaited<
  ReturnType<typeof getTranslations<"AssetPhotos">>
>;

export const logPhotoActionError = createActionErrorLogger(
  "assets/photos/actions",
);

const REJECTION_MESSAGE_KEYS: Readonly<
  Record<PhotoRejection, Parameters<PhotoTranslate>[0]>
> = {
  UNSUPPORTED_TYPE: "unsupportedFormat",
  TOO_LARGE: "tooLarge",
  EMPTY: "uploadIncomplete",
};

const FAILURE_MESSAGE_KEYS: Readonly<
  Record<PhotoFailureReason, Parameters<PhotoTranslate>[0]>
> = {
  NOT_FOUND: "photoNotFound",
  LIMIT_REACHED: "limitReached",
};

export function rejectionMessage(
  t: PhotoTranslate,
  rejection: PhotoRejection,
): string {
  return t(REJECTION_MESSAGE_KEYS[rejection]);
}

export function failureMessage(
  t: PhotoTranslate,
  reason: PhotoFailureReason,
): string {
  return t(FAILURE_MESSAGE_KEYS[reason]);
}

export function refuse(message: string): PhotoActionResult<never> {
  return { ok: false, message };
}

export function succeed(): PhotoActionResult<undefined> {
  return { ok: true, value: undefined };
}
