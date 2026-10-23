/**
 * The rules an asset photo has to satisfy (PRD FR-4.1, FR-4.6, FR-4.8;
 * ADR 0009).
 *
 * Everything here is pure and has no knowledge of Prisma, of Next.js or of
 * React. It is imported by the browser (to fail an obviously wrong file before
 * spending a compression pass and an upload on it) and by the upload route in
 * `src/app/api/assets/[id]/photos/route.ts` (where the same rules are the
 * actual control). The client-side use is a courtesy; the server-side use is
 * the security boundary, and neither trusts the other's result.
 */

/**
 * The content types a photo may be stored as (FR-4.6). The upload route
 * decides which one a part is from its leading bytes, never from the type the
 * browser declared, and the serving route answers with the type stored here.
 */
export const PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

/**
 * 1.5 MB, decimal — 1 500 000 bytes, not 1 572 864 (FR-4.6). The requirement
 * says MB, and this project distinguishes MB from MiB.
 *
 * Compression targets ~400 KB, so this leaves nearly four times the expected
 * size of headroom. It is a ceiling on what may be stored at all, not a target
 * anything is expected to approach.
 */
export const MAX_PHOTO_BYTES = 1_500_000;

/** Room for everything in one upload request that is not image bytes: the
 * multipart boundaries, two part headers, and the two dimension fields. Those
 * come to well under a kilobyte; the allowance is generous so that no honest
 * request is ever refused for its framing. */
export const MULTIPART_OVERHEAD_BYTES = 200_000;

/** One upload carries the full image and its thumbnail (FR-4.3). */
export const DERIVATIVES_PER_UPLOAD = 2;

/**
 * The largest upload request body the server will read (ADR 0009): two
 * derivatives at the per-photo ceiling plus the multipart framing, 3.2 MB.
 * It stays under the 4.5 MB request limit of serverless hosts, so moving to
 * one later is not foreclosed by this number.
 */
export const MAX_UPLOAD_BODY_BYTES =
  DERIVATIVES_PER_UPLOAD * MAX_PHOTO_BYTES + MULTIPART_OVERHEAD_BYTES;

/** FR-4.1. Enforced server-side inside the transaction that inserts the row,
 * so two simultaneous uploads cannot both read "four" and both insert. */
export const MAX_PHOTOS_PER_ASSET = 5;

/**
 * HEIC/HEIF is what an iPhone produces by default and it is the single most
 * likely rejected format in this product's actual use (FR-4.8). No browser
 * decodes it to a canvas, so `browser-image-compression` cannot convert it
 * either: the failure has to be named before compression is attempted, or the
 * user gets a decode error instead of an explanation.
 */
export const HEIC_CONTENT_TYPES = ["image/heic", "image/heif"] as const;
const HEIC_FILE_EXTENSIONS = [".heic", ".heif"] as const;

const PHOTO_CONTENT_TYPE_SET: ReadonlySet<string> = new Set(
  PHOTO_CONTENT_TYPES,
);
const HEIC_CONTENT_TYPE_SET: ReadonlySet<string> = new Set(HEIC_CONTENT_TYPES);

/** `FF D8 FF`, the start of every JPEG (an SOI marker and the next marker's
 * first byte). */
const JPEG_SIGNATURE: readonly number[] = [0xff, 0xd8, 0xff];

/** The eight-byte PNG signature: `\x89PNG\r\n\x1A\n`. */
const PNG_SIGNATURE: readonly number[] = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
];

/** A WebP file is a RIFF container — `RIFF`, a four-byte size, then the form
 * type `WEBP` at byte offset 8. Checking `RIFF` alone would also accept WAV
 * and AVI files. */
const RIFF_SIGNATURE: readonly number[] = [0x52, 0x49, 0x46, 0x46];
const WEBP_FORM_TYPE: readonly number[] = [0x57, 0x45, 0x42, 0x50];
const WEBP_FORM_TYPE_OFFSET = 8;

export function isPhotoContentType(value: string): value is PhotoContentType {
  return PHOTO_CONTENT_TYPE_SET.has(value);
}

/**
 * Whether a picked file is HEIC/HEIF. Checked on both the reported type and
 * the file name, because Windows and some Android browsers report an empty
 * `File.type` for a `.heic` a user copied off a phone, and an empty type would
 * otherwise fall through to the generic "unsupported format" message rather
 * than the one that names the problem.
 */
export function isHeicFile(fileName: string, contentType: string): boolean {
  if (HEIC_CONTENT_TYPE_SET.has(contentType.toLowerCase())) {
    return true;
  }
  const lowerName = fileName.toLowerCase();
  return HEIC_FILE_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension),
  );
}

/** Whether `bytes` holds `signature` starting at `offset`. A buffer too short
 * to hold it is a mismatch, never an out-of-range read. */
function hasSignatureAt(
  bytes: Uint8Array,
  signature: readonly number[],
  offset: number,
): boolean {
  if (bytes.length < offset + signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * What a photo really is, read from its leading bytes, or `null` when it is
 * none of the allowed types (ADR 0009).
 *
 * This is the type the server stores and later serves with `nosniff`, so it
 * must come from the file itself: a declared type is whatever the browser, or
 * whoever is pretending to be one, chose to write in a part header.
 */
export function detectPhotoContentType(
  bytes: Uint8Array,
): PhotoContentType | null {
  if (hasSignatureAt(bytes, JPEG_SIGNATURE, 0)) {
    return "image/jpeg";
  }
  if (hasSignatureAt(bytes, PNG_SIGNATURE, 0)) {
    return "image/png";
  }
  const isWebp =
    hasSignatureAt(bytes, RIFF_SIGNATURE, 0) &&
    hasSignatureAt(bytes, WEBP_FORM_TYPE, WEBP_FORM_TYPE_OFFSET);
  return isWebp ? "image/webp" : null;
}

/** Why one candidate photo is refused. Each member maps to its own message
 * key: "too large" and "wrong format" are different problems with different
 * remedies. */
export type PhotoRejection = "UNSUPPORTED_TYPE" | "TOO_LARGE" | "EMPTY";

export interface PhotoCandidate {
  readonly contentType: string;
  readonly sizeBytes: number;
}

export type PhotoAcceptance =
  | {
      readonly isAccepted: true;
      readonly contentType: PhotoContentType;
      readonly sizeBytes: number;
    }
  | { readonly isAccepted: false; readonly rejection: PhotoRejection };

/**
 * The size-and-type rule (FR-4.6) applied to what a file *says* it is. The
 * browser runs it on the two derivatives it is about to send, so a photo the
 * server would refuse is never uploaded; the server's control is
 * `inspectPhotoPart` below, which reads the bytes instead.
 *
 * Order matters. The type is reported before the size, so a 9 MB HEIC is
 * refused for being HEIC — the thing the user can act on — rather than for
 * being large. An empty file is reported as empty rather than as an allowed
 * type of zero bytes, because a zero-byte upload means the transfer failed
 * rather than that the user chose badly.
 */
export function acceptPhoto({
  contentType,
  sizeBytes,
}: PhotoCandidate): PhotoAcceptance {
  if (!isPhotoContentType(contentType)) {
    return { isAccepted: false, rejection: "UNSUPPORTED_TYPE" };
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { isAccepted: false, rejection: "EMPTY" };
  }
  if (sizeBytes > MAX_PHOTO_BYTES) {
    return { isAccepted: false, rejection: "TOO_LARGE" };
  }
  return { isAccepted: true, contentType, sizeBytes };
}

/** One part of an upload as the server received it: the bytes, and the type
 * the part header declared for them. */
export interface PhotoPart {
  readonly declaredType: string;
  readonly bytes: Uint8Array;
}

/**
 * The server's whole size-and-type control for one uploaded derivative
 * (FR-4.6, ADR 0009).
 *
 * - An empty part is `EMPTY`: there is nothing to identify, and an empty part
 *   means the transfer failed.
 * - A part whose bytes are not JPEG, PNG or WebP is `UNSUPPORTED_TYPE`, and so
 *   is a part whose declared type disagrees with its bytes. A disagreement is
 *   never "corrected" to the detected type: a client that declares one thing
 *   and sends another is refused, not reinterpreted.
 * - A part over `MAX_PHOTO_BYTES` is `TOO_LARGE`, its size measured here.
 *
 * The type is checked before the size for the reason `acceptPhoto` gives.
 */
export function inspectPhotoPart({
  declaredType,
  bytes,
}: PhotoPart): PhotoAcceptance {
  if (bytes.length === 0) {
    return { isAccepted: false, rejection: "EMPTY" };
  }
  const detectedType = detectPhotoContentType(bytes);
  if (detectedType === null || detectedType !== declaredType) {
    return { isAccepted: false, rejection: "UNSUPPORTED_TYPE" };
  }
  if (bytes.length > MAX_PHOTO_BYTES) {
    return { isAccepted: false, rejection: "TOO_LARGE" };
  }
  return {
    isAccepted: true,
    contentType: detectedType,
    sizeBytes: bytes.length,
  };
}
