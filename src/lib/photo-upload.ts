import { nanoid } from "nanoid";

/**
 * The rules an asset photo has to satisfy, and the object path it is stored
 * at (PRD FR-4.1, FR-4.6, FR-4.8, FR-4.9).
 *
 * Everything here is pure and has no knowledge of Supabase, of Prisma, or of
 * React. It is imported by the browser (to fail an obviously wrong file before
 * spending a compression pass on it) and by the server actions in
 * `src/app/(app)/assets/photos/actions.ts` (where the same rules are the
 * actual control). The client-side use is a courtesy; the server-side use is
 * the security boundary, and neither trusts the other's result.
 */

/**
 * The content types a photo may be stored as (FR-4.6). This is also the
 * bucket's own allowed-MIME list — see `docs/supabase-storage-provisioning.md`
 * — but the bucket is a backstop rather than the control: it is configured in
 * a dashboard, not in this repository, so it cannot be reviewed in a pull
 * request and cannot be asserted by a test.
 */
export const PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

/**
 * 1.5 MB, decimal — 1 500 000 bytes, not 1 572 864 (FR-4.6). The provisioning
 * document spells the bucket's own ceiling "10 MiB (10485760 bytes)", so this
 * project distinguishes MB from MiB, and the requirement says MB.
 *
 * Compression targets ~400 KB, so this leaves nearly four times the expected
 * size of headroom. It is a ceiling on what may be stored at all, not a target
 * anything is expected to approach.
 */
export const MAX_PHOTO_BYTES = 1_500_000;

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

const EXTENSION_BY_CONTENT_TYPE: Readonly<Record<PhotoContentType, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PHOTO_CONTENT_TYPE_SET: ReadonlySet<string> = new Set(
  PHOTO_CONTENT_TYPES,
);
const PHOTO_EXTENSION_SET: ReadonlySet<string> = new Set(
  Object.values(EXTENSION_BY_CONTENT_TYPE),
);
const HEIC_CONTENT_TYPE_SET: ReadonlySet<string> = new Set(HEIC_CONTENT_TYPES);

/** The object-name half of `assets/<assetId>/<nanoid>.<ext>`. Twelve is the
 * `qrToken` length and this is not that: an object name only has to be unique
 * within one asset's folder, but it is also public forever once uploaded, so
 * it is drawn from `nanoid` — never `Math.random()` (S2245) — at a length
 * that makes enumerating a bucket pointless. */
export const PHOTO_OBJECT_ID_LENGTH = 16;

/** `nanoid`'s URL-safe alphabet. One anchored quantifier over a character
 * class, so there is nothing here to backtrack (S5852 / S8786). */
const PHOTO_OBJECT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const PHOTO_OBJECT_ROOT = "assets";

/** Every object belonging to one asset shares this prefix, which is what lets
 * the delete path and the dev-bucket purge script work per asset rather than
 * per object. */
export function photoObjectPrefix(assetId: string): string {
  return `${PHOTO_OBJECT_ROOT}/${assetId}/`;
}

export function isPhotoContentType(value: string): value is PhotoContentType {
  return PHOTO_CONTENT_TYPE_SET.has(value);
}

export function photoExtensionFor(contentType: PhotoContentType): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType];
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

/** `assets/<assetId>/<nanoid>.<ext>` (FR-4.9). The extension comes from the
 * allowlist, never from the uploaded file's name — a name is client-supplied
 * and would otherwise decide part of a storage path. */
export function buildPhotoObjectPath(
  assetId: string,
  contentType: PhotoContentType,
): string {
  const objectId = nanoid(PHOTO_OBJECT_ID_LENGTH);
  return `${photoObjectPrefix(assetId)}${objectId}.${photoExtensionFor(contentType)}`;
}

/**
 * Whether `objectPath` is a path this application could have minted for
 * `assetId`.
 *
 * The browser tells the server which object it uploaded to, so that string
 * comes back from the client and is used to delete objects and to fill a
 * database column. Without this check, a caller with a valid session could
 * name any object in the bucket — including another asset's photo — and have
 * the server stat it, store it, or delete it.
 */
export function isPhotoObjectPathFor(
  assetId: string,
  objectPath: string,
): boolean {
  const prefix = photoObjectPrefix(assetId);
  if (!objectPath.startsWith(prefix)) {
    return false;
  }
  const objectName = objectPath.slice(prefix.length);
  const separatorIndex = objectName.lastIndexOf(".");
  if (separatorIndex !== PHOTO_OBJECT_ID_LENGTH) {
    return false;
  }
  const objectId = objectName.slice(0, separatorIndex);
  const extension = objectName.slice(separatorIndex + 1);
  return (
    PHOTO_OBJECT_ID_PATTERN.test(objectId) && PHOTO_EXTENSION_SET.has(extension)
  );
}

/** Why one candidate photo is refused, or `null` when it is acceptable. Each
 * member maps to its own message key: "too large" and "wrong format" are
 * different problems with different remedies. */
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
 * The whole of the size-and-type control (FR-4.6), in one pure function so
 * that the server action and the browser cannot drift apart on what they
 * consider acceptable.
 *
 * It narrows rather than merely answering yes or no: an accepted candidate
 * comes back with its `contentType` typed as one of the allowlisted members,
 * which is what `buildPhotoObjectPath` needs. Without that, the caller would
 * have to re-check the same condition purely to satisfy the compiler, and a
 * restated check is a check that can be restated wrongly.
 *
 * Order matters. The type is reported before the size, so a 9 MB HEIC is
 * refused for being HEIC — the thing the user can act on — rather than for
 * being large. An empty object is reported as empty rather than as an allowed
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
