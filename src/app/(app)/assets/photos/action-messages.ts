import type { getTranslations } from "next-intl/server";

import { MAX_PHOTOS_PER_ASSET } from "@/lib/photo-upload";

import type { PhotoFailureReason } from "./mutations";
import type { PhotoActionResult } from "./schemas";

/**
 * Turning a refusal into something a user can read.
 *
 * Separate from `actions.ts` so that a `"use server"` module — which may
 * export only async functions — is not the place these synchronous helpers
 * live, and so the upload route can share the translator type.
 *
 * Every message goes through `next-intl`, including the ones nobody expects
 * to see: an unexpected failure still gets a localised sentence rather than
 * an error string, because `CLAUDE.md` forbids internal error text reaching a
 * user, and an untranslated fallback is exactly how that leaks.
 */

export type PhotoTranslate = Awaited<
  ReturnType<typeof getTranslations<"AssetPhotos">>
>;

/** The values every photo message may interpolate. `limitReached` names the
 * limit, so it is always supplied; a message without the placeholder ignores
 * it. Without it, next-intl renders the raw `{max, number}` placeholder. */
export const PHOTO_MESSAGE_VALUES = { max: MAX_PHOTOS_PER_ASSET } as const;

const FAILURE_MESSAGE_KEYS: Readonly<
  Record<PhotoFailureReason, Parameters<PhotoTranslate>[0]>
> = {
  NOT_FOUND: "photoNotFound",
  LIMIT_REACHED: "limitReached",
};

export function failureMessage(
  t: PhotoTranslate,
  reason: PhotoFailureReason,
): string {
  return t(FAILURE_MESSAGE_KEYS[reason], PHOTO_MESSAGE_VALUES);
}

export function refuse(message: string): PhotoActionResult<never> {
  return { ok: false, message };
}

export function succeed(): PhotoActionResult<undefined> {
  return { ok: true, value: undefined };
}
