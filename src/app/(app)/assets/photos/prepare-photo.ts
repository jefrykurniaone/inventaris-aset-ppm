import {
  buildCompressionOptions,
  PHOTO_OUTPUT_CONTENT_TYPE,
} from "@/lib/photo-compression";
import { isHeicFile, isPhotoContentType } from "@/lib/photo-upload";

/**
 * Turning one picked file into the two objects that get uploaded
 * (PRD FR-4.3): the full image at 1600 px and its 400 px thumbnail.
 *
 * This runs in the browser and is a usability measure, not a control — the
 * numbers it targets keep a 12-megapixel phone photo inside the egress budget
 * in risk R2 and inside the server's 1.5 MB ceiling, but the server re-checks
 * what actually arrived regardless of whether any of this happened.
 */

/** Why a picked file cannot be prepared. Each maps to its own message: HEIC
 * is separate from "unsupported" because it is the one a user will actually
 * hit, straight off an iPhone, and it deserves an explanation rather than a
 * shrug (FR-4.8). */
export type PhotoPreparationRejection =
  "HEIC_NOT_SUPPORTED" | "UNSUPPORTED_FORMAT";

export class PhotoPreparationError extends Error {
  readonly rejection: PhotoPreparationRejection;

  constructor(rejection: PhotoPreparationRejection) {
    super(`The picked file was refused: ${rejection}.`);
    this.name = "PhotoPreparationError";
    this.rejection = rejection;
  }
}

export interface PreparedPhoto {
  readonly full: File;
  readonly thumbnail: File;
  readonly width: number;
  readonly height: number;
}

export interface PreparePhotoHooks {
  readonly signal?: AbortSignal;
  /** Fraction of the compression phase done, 0 to 1. */
  readonly onProgress?: (fraction: number) => void;
}

const PERCENT = 100;

/**
 * The compression library is loaded on the first pick, not with the page.
 *
 * It is about 57 KB of JavaScript, on an edit form most visits never upload a
 * photo from, reached on a phone over mobile data. A static import puts it in
 * the route's first load; this puts it on the path that actually needs it.
 */
async function loadCompressor() {
  // Not `module`: `@next/next/no-assign-module-variable` reserves that name.
  const compressor = await import("browser-image-compression");
  return compressor.default;
}

/**
 * Refuses a file no browser can decode, before a compression pass turns the
 * refusal into an opaque canvas error.
 *
 * An empty `File.type` is not refused outright: Windows and some Android
 * browsers report nothing for a perfectly ordinary JPEG, and the compression
 * step will fail loudly enough if the file really is not an image.
 */
function assertPreparable(file: File): void {
  if (isHeicFile(file.name, file.type)) {
    throw new PhotoPreparationError("HEIC_NOT_SUPPORTED");
  }
  if (file.type !== "" && !isPhotoContentType(file.type)) {
    throw new PhotoPreparationError("UNSUPPORTED_FORMAT");
  }
}

/** The stored dimensions (FR-4.3), measured on the compressed image rather
 * than on the source, so the row describes the object in the bucket. */
async function measure(
  image: Blob,
): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(image);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/**
 * Compresses `file` twice and measures the result.
 *
 * The two passes are sequential rather than concurrent: both run in a Web
 * Worker on a phone, and racing them on a two-core device makes the visible
 * one slower without finishing sooner.
 */
export async function preparePhoto(
  file: File,
  origin: string,
  hooks: PreparePhotoHooks = {},
): Promise<PreparedPhoto> {
  assertPreparable(file);
  const imageCompression = await loadCompressor();

  const full = await imageCompression(
    file,
    buildCompressionOptions("full", origin, {
      signal: hooks.signal,
      onProgress: (percent) => hooks.onProgress?.(percent / PERCENT),
    }),
  );
  const thumbnail = await imageCompression(
    full,
    buildCompressionOptions("thumbnail", origin, { signal: hooks.signal }),
  );
  const { width, height } = await measure(full);

  return { full, thumbnail, width, height };
}

/** What the browser declares it is about to upload. The library returns a
 * `File` whose `type` is the encoded type, but a browser without WebP
 * encoding silently falls back to the source type, so the declaration is read
 * off the result rather than assumed. */
export function declaredContentType(image: File): string {
  return image.type || PHOTO_OUTPUT_CONTENT_TYPE;
}
