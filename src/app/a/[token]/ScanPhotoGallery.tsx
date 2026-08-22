import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { THUMBNAIL_MAX_EDGE_PX } from "@/lib/photo-compression";
import { cn } from "@/lib/utils";

import type { ScanPhoto } from "./queries";
import { SELECTED_PHOTO_PARAM } from "./schemas";

/**
 * The public gallery (PRD FR-4.7): one photo at full size, and a strip of
 * thumbnails to change which one.
 *
 * No client JavaScript and no lightbox. Each thumbnail is a `<Link>` back to
 * this same page carrying `?photo=<id>`, so choosing one is a server render —
 * which is what keeps the page working with scripting disabled and keeps the
 * 2.5 s budget free of a hydration bundle. `<Link>` is a real `<a>`, so it is
 * focusable and activates on Enter without an `onKeyDown` (S1082).
 *
 * `unoptimized`, matching every other photo surface here: the upload pipeline
 * already stores exactly-sized derivatives, and re-encoding them through the
 * optimiser is the egress cost PRD risk R2 exists to avoid.
 */

interface ScanPhotoGalleryProps {
  readonly photos: readonly ScanPhoto[];
  readonly selected: ScanPhoto;
  readonly assetName: string;
  readonly categoryName: string;
  readonly scanPath: string;
}

function photoHref(scanPath: string, photoId: string): string {
  return `${scanPath}?${SELECTED_PHOTO_PARAM}=${encodeURIComponent(photoId)}`;
}

export async function ScanPhotoGallery({
  photos,
  selected,
  assetName,
  categoryName,
  scanPath,
}: Readonly<ScanPhotoGalleryProps>) {
  const [t, tPhotos] = await Promise.all([
    getTranslations("ScanPage"),
    getTranslations("AssetPhotos"),
  ]);

  const altOf = (position: number) =>
    tPhotos("photoAlt", {
      name: assetName,
      category: categoryName,
      position,
    });

  const selectedPosition =
    photos.findIndex((photo) => photo.id === selected.id) + 1;

  return (
    <section
      aria-labelledby="scan-photos-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="scan-photos-heading" className="sr-only">
        {t("photosHeading")}
      </h2>
      <Image
        src={selected.url}
        alt={altOf(selectedPosition)}
        width={selected.width}
        height={selected.height}
        unoptimized
        priority
        className="border-border h-auto w-full rounded-md border object-contain"
      />
      {photos.length > 1 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t("photosHeading")}>
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <Link
                href={photoHref(scanPath, photo.id)}
                aria-current={photo.id === selected.id ? "true" : undefined}
                aria-label={t("photoSelectLabel", { position: index + 1 })}
                className={cn(
                  "focus-visible:ring-ring block rounded-md focus-visible:ring-2 focus-visible:outline-none",
                  photo.id === selected.id && "ring-primary ring-2",
                )}
              >
                <Image
                  src={photo.thumbnailUrl}
                  alt={altOf(index + 1)}
                  width={THUMBNAIL_MAX_EDGE_PX}
                  height={THUMBNAIL_MAX_EDGE_PX}
                  unoptimized
                  className="h-16 w-16 rounded-md object-cover"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
