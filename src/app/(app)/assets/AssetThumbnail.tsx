import Image from "next/image";

import { THUMBNAIL_MAX_EDGE_PX } from "@/lib/photo-compression";

import { AssetThumbnailPlaceholder } from "./AssetThumbnailPlaceholder";

interface AssetThumbnailProps {
  readonly thumbnailUrl: string | null;
  readonly alt: string;
  readonly placeholderLabel: string;
}

/**
 * The list's thumbnail cell (PRD FR-2.6): the asset's primary photo when one
 * exists, the localised placeholder otherwise. `AssetRow` and `AssetCard`
 * both render this, so the table and the phone card never disagree on the
 * cell's contents.
 *
 * Fixed at 40x40 (`h-10 w-10`, matching `AssetThumbnailPlaceholder`) so a
 * page mixing photographed and unphotographed rows never shifts the
 * surrounding layout. `unoptimized` — same reasoning as `PhotoCard.tsx`: the
 * pipeline already stores an exactly-sized derivative, so routing it through
 * Next's optimiser would re-encode an already-optimal image and add the
 * egress cost PRD risk R2 exists to avoid.
 */
export function AssetThumbnail({
  thumbnailUrl,
  alt,
  placeholderLabel,
}: Readonly<AssetThumbnailProps>) {
  if (!thumbnailUrl) {
    return <AssetThumbnailPlaceholder label={placeholderLabel} />;
  }

  return (
    <Image
      src={thumbnailUrl}
      alt={alt}
      width={THUMBNAIL_MAX_EDGE_PX}
      height={THUMBNAIL_MAX_EDGE_PX}
      unoptimized
      className="h-10 w-10 shrink-0 rounded-md object-cover"
    />
  );
}
