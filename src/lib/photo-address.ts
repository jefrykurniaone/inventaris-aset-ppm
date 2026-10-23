/**
 * Where a photo lives on this application's own origin (ADR 0009).
 *
 * Photo bytes are stored in PostgreSQL and served by
 * `src/app/api/photos/[photoId]/[variant]/route.ts`, so every surface that
 * shows a photo — the detail gallery, the lightbox, the edit manager, the list
 * thumbnail and the public scan page — builds its address here, from the photo
 * id alone. Nothing stores a URL or a path, so the address scheme can change
 * without a data migration.
 *
 * Pure, and free of any server-only import, because the browser builds the
 * upload address with it too.
 */

/** The two stored derivatives of one photo: the full image (1600 px) and its
 * thumbnail (400 px). The names are the last segment of the serving address. */
export const PHOTO_VARIANTS = ["full", "thumb"] as const;

export type PhotoVariant = (typeof PHOTO_VARIANTS)[number];

const PHOTO_VARIANT_SET: ReadonlySet<string> = new Set(PHOTO_VARIANTS);

/** The serving route's prefix. It sits under `/api`, which the request
 * middleware does not process (`src/middleware.ts`). */
export const PHOTO_ROUTE_PREFIX = "/api/photos";

const ASSET_ROUTE_PREFIX = "/api/assets";
const PHOTOS_SEGMENT = "photos";

export function isPhotoVariant(value: string): value is PhotoVariant {
  return PHOTO_VARIANT_SET.has(value);
}

/** `/api/photos/<photoId>/<variant>`. The id is encoded so that no value can
 * add a path segment, however it was obtained. */
export function photoAddress(photoId: string, variant: PhotoVariant): string {
  return `${PHOTO_ROUTE_PREFIX}/${encodeURIComponent(photoId)}/${variant}`;
}

/** `/api/assets/<assetId>/photos`, the address one photo is uploaded to. */
export function photoUploadAddress(assetId: string): string {
  return `${ASSET_ROUTE_PREFIX}/${encodeURIComponent(assetId)}/${PHOTOS_SEGMENT}`;
}
