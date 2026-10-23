import { getLocale } from "next-intl/server";

import { db } from "@/lib/db";
import { photoAddress } from "@/lib/photo-address";

/**
 * Reads for the photo surfaces (PRD FR-4.7, FR-4.9).
 *
 * Only columns on the public side of the §8.2 split are selected: the asset's
 * name, its category's name, and the photo rows themselves. No custodian and
 * no pricing column is fetched here at all, so this query is already safe to
 * reuse from the public scan page (#11) without a second review.
 *
 * The two addresses are built here, at read time, from the photo id: both
 * point at the application's own serving route (ADR 0009). The photo's bytes
 * are never selected by this query — they stay in the side table only
 * `src/lib/storage.ts` reads.
 */

export interface AssetPhotoView {
  readonly id: string;
  readonly url: string;
  readonly thumbnailUrl: string;
  readonly isPrimary: boolean;
}

export interface AssetPhotoContext {
  readonly assetName: string;
  readonly categoryName: string;
  readonly photos: readonly AssetPhotoView[];
}

/** Newest last, primary first — the same order the list view and the scan
 * page will want, so no surface re-sorts what it is handed. */
const PHOTO_ORDER = [
  { isPrimary: "desc" },
  { sortOrder: "asc" },
  { createdAt: "asc" },
] as const;

export async function findAssetPhotoContext(
  assetId: string,
): Promise<AssetPhotoContext | null> {
  const asset = await db.asset.findFirst({
    where: { id: assetId, deletedAt: null },
    select: {
      name: true,
      category: { select: { name: true, nameEn: true } },
      photos: {
        orderBy: [...PHOTO_ORDER],
        select: { id: true, isPrimary: true },
      },
    },
  });
  if (!asset) {
    return null;
  }

  const locale = await getLocale();

  return {
    assetName: asset.name,
    categoryName: locale === "en" ? asset.category.nameEn : asset.category.name,
    photos: asset.photos.map((photo) => ({
      id: photo.id,
      url: photoAddress(photo.id, "full"),
      thumbnailUrl: photoAddress(photo.id, "thumb"),
      isPrimary: photo.isPrimary,
    })),
  };
}
