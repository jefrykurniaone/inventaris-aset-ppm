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
 * The full-size photo is this route's Largest Contentful Paint element, and
 * issue #110 is what it cost while it rendered `unoptimized`. Two things were
 * wrong with that at once. The stored derivative measured 125,866 bytes at
 * 1200x1600 for a slot 380 CSS px wide under Lighthouse's mobile profile, and
 * it came from the storage host — a second origin, so a DNS, TCP and TLS
 * handshake stood in front of the first byte. The route measured 2694-2917 ms
 * LCP against a 2500 ms budget.
 *
 * So this is the one photo surface here that goes through the optimiser.
 * `/_next/image` is same-origin, which reuses the connection the document
 * already opened, and the 750 px candidate the mobile profile picks measured
 * 24,586 bytes against the original's 125,866 — 80% less. PRD risk R2 is not
 * crossed by that: R2 is about Supabase egress, and the optimiser lowers it.
 * Stored objects carry `Cache-Control: public, max-age=31536000, immutable`,
 * Vercel's image cache takes the larger of that and `minimumCacheTTL`, and the
 * object paths are content-addressed and never rewritten — so each
 * (photo, width) pair is fetched out of the bucket once and never again.
 *
 * The thumbnails stay `unoptimized`. A 400 px WebP drawn at 64 px is already
 * small, it is lazy, and it is not the LCP element — optimising it would buy
 * transformations and nothing else.
 *
 * `priority` alone does not tell the browser the preload is urgent.
 * `next/image` passes `fetchPriority` straight through and defaults it to
 * nothing — see `getImgProps` in
 * `node_modules/next/dist/shared/lib/get-img-props.js` — so the
 * `<link rel="preload" as="image">` it emits carries no priority at all, while
 * nine `async` script tags totalling roughly 137 KB compete for the same
 * throttled throughput. `fetchPriority="high"` is what ranks the LCP element
 * above them.
 */

/**
 * The `sizes` hint for the full-size photo, read off the shell rather than
 * guessed: `ScanPageShell`'s `<main>` is `max-w-2xl` (42rem, 672 px) with `p-4`
 * (1rem a side), so the photo's box is 640 px wide once the shell reaches that
 * maximum and `100vw` minus those two paddings below it. Without a `sizes` the
 * optimiser has no width to choose between and serves the largest candidate,
 * which is the byte cost this ticket exists to remove.
 */
const HERO_PHOTO_SIZES = "(min-width: 672px) 640px, calc(100vw - 2rem)";

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
        sizes={HERO_PHOTO_SIZES}
        priority
        fetchPriority="high"
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
