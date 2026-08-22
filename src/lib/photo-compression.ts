/**
 * The browser-side compression settings (PRD FR-4.3), as a pure builder.
 *
 * Two derivatives are produced from one picked file: the full image kept for
 * the detail and scan pages, and a 400 px thumbnail used everywhere else
 * (FR-4.7). Both are re-encoded to WebP, which is what makes a 12-megapixel
 * phone photo land at roughly 400 KB rather than the 4 MB a JPEG of the same
 * dimensions would cost.
 *
 * This is a usability measure and not a control. Nothing here is trusted by
 * the server: `src/lib/photo-upload.ts` re-checks the content type and the
 * size of what actually reached the bucket, and would refuse an upload from a
 * client that skipped this step entirely.
 *
 * The file is pure so that the numbers below — which are the difference
 * between an upload that fits the egress budget in PRD risk R2 and one that
 * does not — are assertable in a unit test rather than only observable by
 * watching a real upload.
 */

/**
 * Where the compression worker is served from.
 *
 * `browser-image-compression` runs its work in a Web Worker built from a blob,
 * and that worker `importScripts()` the library again from `options.libURL`,
 * whose default is `https://cdn.jsdelivr.net/npm/browser-image-compression/…`.
 * A runtime script from a third-party content delivery network is prohibited
 * by `CLAUDE.md` and by issue #21, so the library's own `dist` build is
 * vendored into `public/vendor/` and served from this application's origin.
 * `src/lib/photo-compression.test.ts` asserts the vendored copy is
 * byte-identical to the installed package, so an upgrade that forgets to
 * re-vendor fails the test run rather than silently shipping a stale worker.
 */
export const COMPRESSION_WORKER_PATH = "/vendor/browser-image-compression.js";

/** Longest edge of the stored full-size image, in pixels (FR-4.3). */
export const FULL_IMAGE_MAX_EDGE_PX = 1600;

/** Longest edge of the thumbnail, in pixels (FR-4.3). */
export const THUMBNAIL_MAX_EDGE_PX = 400;

/** Target size of the stored full-size image, in megabytes (FR-4.3): about
 * 400 KB, comfortably inside the 1.5 MB the server will accept. */
export const FULL_IMAGE_MAX_SIZE_MB = 0.4;

/** A 400 px WebP lands well under this; the value is a ceiling that keeps a
 * pathological source image from producing a thumbnail heavier than the full
 * image it was derived from. */
export const THUMBNAIL_MAX_SIZE_MB = 0.08;

/** Where the encoder starts before the library's own size-seeking loop takes
 * over. 0.82 is high enough that a label or a serial number photographed at
 * arm's length stays legible after the resize. */
export const PHOTO_INITIAL_QUALITY = 0.82;

/** Both derivatives are stored as WebP regardless of what was picked, which
 * is why the server's allowlist has to keep accepting JPEG and PNG too: a
 * browser that cannot encode WebP falls back to the source type. */
export const PHOTO_OUTPUT_CONTENT_TYPE = "image/webp";

export type PhotoDerivative = "full" | "thumbnail";

interface DerivativeSpec {
  readonly maxSizeMB: number;
  readonly maxWidthOrHeight: number;
}

const DERIVATIVE_SPECS: Readonly<Record<PhotoDerivative, DerivativeSpec>> = {
  full: {
    maxSizeMB: FULL_IMAGE_MAX_SIZE_MB,
    maxWidthOrHeight: FULL_IMAGE_MAX_EDGE_PX,
  },
  thumbnail: {
    maxSizeMB: THUMBNAIL_MAX_SIZE_MB,
    maxWidthOrHeight: THUMBNAIL_MAX_EDGE_PX,
  },
};

/** The subset of the library's `Options` this project sets. Declared here
 * rather than imported so that this module — and its test — stay free of the
 * library, which reaches for `window` on import. */
export interface PhotoCompressionOptions {
  readonly maxSizeMB: number;
  readonly maxWidthOrHeight: number;
  readonly useWebWorker: boolean;
  readonly fileType: string;
  readonly initialQuality: number;
  readonly libURL: string;
  readonly signal?: AbortSignal;
  readonly onProgress?: (percent: number) => void;
}

export interface CompressionHooks {
  readonly signal?: AbortSignal;
  readonly onProgress?: (percent: number) => void;
}

/**
 * Builds the option object for one derivative.
 *
 * `origin` is a parameter rather than a read of `location.origin` so that the
 * function is callable — and assertable — outside a browser. `libURL` must be
 * absolute: the worker is constructed from a `blob:` URL, and a relative
 * `importScripts` inside it would resolve against the blob rather than
 * against this application.
 */
export function buildCompressionOptions(
  derivative: PhotoDerivative,
  origin: string,
  hooks: CompressionHooks = {},
): PhotoCompressionOptions {
  const spec = DERIVATIVE_SPECS[derivative];
  return {
    maxSizeMB: spec.maxSizeMB,
    maxWidthOrHeight: spec.maxWidthOrHeight,
    useWebWorker: true,
    fileType: PHOTO_OUTPUT_CONTENT_TYPE,
    initialQuality: PHOTO_INITIAL_QUALITY,
    libURL: new URL(COMPRESSION_WORKER_PATH, origin).toString(),
    ...hooks,
  };
}
