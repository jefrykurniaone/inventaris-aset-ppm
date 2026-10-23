import { describeError } from "@/lib/log-error";
import { photoUploadAddress } from "@/lib/photo-address";
import { acceptPhoto, type PhotoRejection } from "@/lib/photo-upload";

import { UploadCancelledError, postPhotoUpload } from "./post-photo-upload";
import {
  declaredContentType,
  preparePhoto,
  PhotoPreparationError,
  type PreparedPhoto,
} from "./prepare-photo";
import { PHOTO_UPLOAD_FIELD } from "./schemas";

/**
 * One photo, from picked file to saved row: compress in the browser, then
 * send both derivatives to the upload route in one request (PRD FR-4.3;
 * ADR 0009).
 *
 * A plain async function rather than part of the hook, so the sequence is
 * readable in one place and so nothing about it depends on React. The
 * localised strings arrive as `messages` for the same reason — the hook owns
 * `next-intl`, this owns the order of operations.
 *
 * Every refusal the server sends back is already localised, so it is passed
 * through untouched. The strings in `messages` cover only the failures that
 * happen entirely inside the browser.
 */

export type PhotoUploadPhase = "idle" | "preparing" | "uploading" | "saving";

export interface PhotoUploadMessages {
  readonly heicNotSupported: string;
  readonly unsupportedFormat: string;
  readonly tooLarge: string;
  readonly uploadFailed: string;
}

/** `message: null` means the user cancelled: an outcome, not a failure, and
 * nothing to put on the screen. */
export type RunPhotoUploadResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string | null };

export interface RunPhotoUploadInput {
  readonly assetId: string;
  readonly file: File;
  readonly origin: string;
  readonly signal: AbortSignal;
  readonly onProgress: (fraction: number) => void;
  readonly onPhase: (phase: PhotoUploadPhase) => void;
  readonly messages: PhotoUploadMessages;
}

/** How the progress bar is divided. Compression dominates on a phone, so it
 * gets the larger share; the trailing slice is the server writing the row and
 * the bytes, which is short but should not leave the bar stuck at full. */
const PREPARE_SHARE = 0.5;
const UPLOAD_SHARE = 0.45;

function preparationMessage(
  error: PhotoPreparationError,
  messages: PhotoUploadMessages,
): string {
  return error.rejection === "HEIC_NOT_SUPPORTED"
    ? messages.heicNotSupported
    : messages.unsupportedFormat;
}

/**
 * The rejection, if any, the server would give either derivative for its
 * declared type and size — checked here so a photo that cannot be stored is
 * never sent. A courtesy, not the control: the route reads the bytes.
 */
function localRejection(prepared: PreparedPhoto): PhotoRejection | null {
  for (const image of [prepared.full, prepared.thumbnail]) {
    const acceptance = acceptPhoto({
      contentType: declaredContentType(image),
      sizeBytes: image.size,
    });
    if (!acceptance.isAccepted) {
      return acceptance.rejection;
    }
  }
  return null;
}

function rejectionMessage(
  rejection: PhotoRejection,
  messages: PhotoUploadMessages,
): string {
  if (rejection === "TOO_LARGE") {
    return messages.tooLarge;
  }
  return rejection === "UNSUPPORTED_TYPE"
    ? messages.unsupportedFormat
    : messages.uploadFailed;
}

/** The four multipart parts the route reads. Each image goes in as a `Blob`
 * typed with the declared content type, which is what the route compares
 * against the bytes. */
function buildUploadBody(prepared: PreparedPhoto): FormData {
  const body = new FormData();
  for (const [field, image] of [
    [PHOTO_UPLOAD_FIELD.full, prepared.full],
    [PHOTO_UPLOAD_FIELD.thumbnail, prepared.thumbnail],
  ] as const) {
    const typed = new Blob([image], { type: declaredContentType(image) });
    body.append(field, typed, image.name);
  }
  body.append(PHOTO_UPLOAD_FIELD.width, String(prepared.width));
  body.append(PHOTO_UPLOAD_FIELD.height, String(prepared.height));
  return body;
}

async function upload(
  prepared: PreparedPhoto,
  input: RunPhotoUploadInput,
): Promise<RunPhotoUploadResult> {
  input.onPhase("uploading");
  const response = await postPhotoUpload({
    url: photoUploadAddress(input.assetId),
    body: buildUploadBody(prepared),
    signal: input.signal,
    onProgress: (fraction) =>
      input.onProgress(PREPARE_SHARE + fraction * UPLOAD_SHARE),
    onSent: () => input.onPhase("saving"),
  });
  return response.ok ? { ok: true } : { ok: false, message: response.message };
}

export async function runPhotoUpload(
  input: RunPhotoUploadInput,
): Promise<RunPhotoUploadResult> {
  try {
    input.onPhase("preparing");
    const prepared = await preparePhoto(input.file, input.origin, {
      signal: input.signal,
      onProgress: (fraction) => input.onProgress(fraction * PREPARE_SHARE),
    });

    const rejection = localRejection(prepared);
    if (rejection !== null) {
      return {
        ok: false,
        message: rejectionMessage(rejection, input.messages),
      };
    }
    return await upload(prepared, input);
  } catch (error) {
    return { ok: false, message: failureMessage(error, input.messages) };
  }
}

function failureMessage(
  error: unknown,
  messages: PhotoUploadMessages,
): string | null {
  if (error instanceof UploadCancelledError) {
    return null;
  }
  if (error instanceof PhotoPreparationError) {
    return preparationMessage(error, messages);
  }
  // Logged, not shown: `messages.uploadFailed` is what the user reads, so no
  // internal error text reaches the screen (`CLAUDE.md`).
  console.error(`assets/photos/run-photo-upload: ${describeError(error)}`);
  return messages.uploadFailed;
}
