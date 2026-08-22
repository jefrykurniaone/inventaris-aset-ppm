import { getTranslations } from "next-intl/server";

import { findAssetPhotoContext } from "../photos/queries";
import { PhotoGalleryClient } from "./PhotoGalleryClient";

/**
 * The read-only gallery on the asset detail page (issue #10): full-size
 * images, primary photo first — `findAssetPhotoContext` already orders them
 * that way (PRD FR-4.1) — with a keyboard-operable lightbox. Reuses the
 * photo pipeline's own read (issue #9) rather than a second query, so the
 * URL-building rule in `../photos/queries.ts` (object path in the database,
 * URL built at render time through `src/lib/storage.ts`) is exercised once.
 *
 * Every localised string a Client Component needs is resolved here, on the
 * server, and passed down as plain data — a function (a translator
 * included) cannot cross the Server/Client boundary as a prop.
 */
export async function PhotoGallery({
  assetId,
}: Readonly<{ readonly assetId: string }>) {
  const [context, td, tPhotos] = await Promise.all([
    findAssetPhotoContext(assetId),
    getTranslations("AssetDetailPage"),
    getTranslations("AssetPhotos"),
  ]);

  const photos = context?.photos ?? [];

  return (
    <section
      aria-labelledby="asset-gallery-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="asset-gallery-heading" className="text-lg font-semibold">
        {td("galleryHeading")}
      </h2>
      {photos.length === 0 || !context ? (
        <p className="text-muted-foreground text-sm">{tPhotos("emptyState")}</p>
      ) : (
        <PhotoGalleryClient
          photos={photos}
          altTexts={photos.map((_photo, index) =>
            tPhotos("photoAlt", {
              name: context.assetName,
              category: context.categoryName,
              position: index + 1,
            }),
          )}
          openLabels={photos.map((_photo, index) =>
            td("lightboxOpenLabel", { position: index + 1 }),
          )}
          counters={photos.map((_photo, index) =>
            td("lightboxCounter", { current: index + 1, total: photos.length }),
          )}
          closeLabel={td("lightboxCloseLabel")}
          previousLabel={td("lightboxPreviousLabel")}
          nextLabel={td("lightboxNextLabel")}
        />
      )}
    </section>
  );
}
