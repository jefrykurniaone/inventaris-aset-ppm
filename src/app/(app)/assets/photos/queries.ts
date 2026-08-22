import { getLocale } from "next-intl/server";

import { db } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";

/**
 * Reads for the photo surfaces (PRD FR-4.7, FR-4.9).
 *
 * Only columns on the public side of the §8.2 split are selected: the asset's
 * name, its category's name, and the photo rows themselves. No custodian and
 * no pricing column is fetched here at all, so this query is already safe to
 * reuse from the public scan page (#11) without a second review.
 *
 * The URL is built here, at read time, from the object path in the database
 * and the bucket the process is configured with (FR-4.9). Nothing stores a
 * URL, so moving to another bucket or another project is a configuration
 * change rather than a data migration.
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
        select: {
          id: true,
          objectPath: true,
          thumbObjectPath: true,
          isPrimary: true,
        },
      },
    },
  });
  if (!asset) {
    return null;
  }

  const locale = await getLocale();
  const storage = getObjectStorage();

  return {
    assetName: asset.name,
    categoryName: locale === "en" ? asset.category.nameEn : asset.category.name,
    photos: asset.photos.map((photo) => ({
      id: photo.id,
      url: storage.getPublicUrl(photo.objectPath),
      thumbnailUrl: storage.getPublicUrl(photo.thumbObjectPath),
      isPrimary: photo.isPrimary,
    })),
  };
}
