"use client";

import Image from "next/image";
import { useState } from "react";

import type { AssetPhotoView } from "../photos/queries";
import { PhotoLightbox } from "./PhotoLightbox";

/**
 * The gallery grid, and the trigger for the lightbox each photo opens.
 *
 * Full-size images (`photo.url`, never `photo.thumbnailUrl`) — the asset
 * detail page and the public scan page (#11) are the only two surfaces PRD
 * FR-4.7 allows that on. `unoptimized` for the same reason `PhotoCard`
 * carries it: the browser already produced an optimal WebP before upload
 * (FR-4.3), so Next's optimiser would only re-encode it and spend the exact
 * egress risk R2 asks the pipeline to avoid.
 */

const GRID_IMAGE_SIZES =
  "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

interface PhotoGalleryClientProps {
  readonly photos: readonly AssetPhotoView[];
  readonly altTexts: readonly string[];
  readonly openLabels: readonly string[];
  readonly counters: readonly string[];
  readonly closeLabel: string;
  readonly previousLabel: string;
  readonly nextLabel: string;
}

export function PhotoGalleryClient({
  photos,
  altTexts,
  openLabels,
  counters,
  closeLabel,
  previousLabel,
  nextLabel,
}: Readonly<PhotoGalleryClientProps>) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              aria-label={openLabels[index]}
              onClick={() => setOpenIndex(index)}
              className="border-border focus-visible:ring-ring relative block aspect-square w-full overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:outline-none"
            >
              <Image
                src={photo.url}
                alt={altTexts[index]}
                fill
                sizes={GRID_IMAGE_SIZES}
                unoptimized
                className="object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      <PhotoLightbox
        photos={photos}
        altTexts={altTexts}
        counters={counters}
        closeLabel={closeLabel}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
        openIndex={openIndex}
        onOpenIndexChange={setOpenIndex}
      />
    </>
  );
}
