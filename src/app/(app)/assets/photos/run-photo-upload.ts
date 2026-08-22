import { describeError } from "@/lib/log-error";

import { requestPhotoUploadAction, attachPhotoAction } from "./actions";
import {
  declaredContentType,
  preparePhoto,
  PhotoPreparationError,
  type PreparedPhoto,
} from "./prepare-photo";
import type { PhotoUploadTargets } from "./schemas";
import {
  UploadCancelledError,
  uploadToSignedUrl,
} from "./upload-to-signed-url";

/**
 * One photo, from picked file to saved row: compress, ask the server for two
 * signed targets, upload straight to storage, then record the result
 * (PRD FR-4.3, FR-4.4).
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
 * gets the larger share; the trailing slice is the round trip that writes the
 * row, which is short but should not leave the bar stuck at full. */
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

/** Uploads both objects, reporting one combined fraction weighted by their
 * real byte counts rather than by a guess. */
async function uploadBoth(
  prepared: PreparedPhoto,
  targets: PhotoUploadTargets,
  input: RunPhotoUploadInput,
): Promise<void> {
  const totalBytes = prepared.full.size + prepared.thumbnail.size;
  let settledBytes = 0;

  const pairs = [
    { image: prepared.full, target: targets.full },
    { image: prepared.thumbnail, target: targets.thumbnail },
  ];

  for (const { image, target } of pairs) {
    await uploadToSignedUrl({
      signedUrl: target.signedUrl,
      body: image,
      contentType: declaredContentType(image),
      signal: input.signal,
      onProgress: (fraction) => {
        const done = (settledBytes + fraction * image.size) / totalBytes;
        input.onProgress(PREPARE_SHARE + done * UPLOAD_SHARE);
      },
    });
    settledBytes += image.size;
  }
}

async function requestTargets(
  prepared: PreparedPhoto,
  assetId: string,
): Promise<PhotoUploadTargets | { readonly message: string }> {
  const result = await requestPhotoUploadAction({
    assetId,
    contentType: declaredContentType(prepared.full),
    sizeBytes: prepared.full.size,
    thumbnailContentType: declaredContentType(prepared.thumbnail),
    thumbnailSizeBytes: prepared.thumbnail.size,
  });
  return result.ok ? result.value : { message: result.message };
}

function isRejected(
  value: PhotoUploadTargets | { readonly message: string },
): value is { readonly message: string } {
  return "message" in value;
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

    const targets = await requestTargets(prepared, input.assetId);
    if (isRejected(targets)) {
      return { ok: false, message: targets.message };
    }

    input.onPhase("uploading");
    await uploadBoth(prepared, targets, input);

    input.onPhase("saving");
    const attached = await attachPhotoAction({
      assetId: input.assetId,
      objectPath: targets.full.objectPath,
      thumbnailObjectPath: targets.thumbnail.objectPath,
      width: prepared.width,
      height: prepared.height,
    });
    return attached.ok
      ? { ok: true }
      : { ok: false, message: attached.message };
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
