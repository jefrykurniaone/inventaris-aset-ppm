import { PhotoManager } from "./PhotoManager";
import { findAssetPhotoContext } from "./queries";

/**
 * The server half of the photo section: one query, then the client component
 * that manages it. Kept apart so the page it is mounted on stays a server
 * component and so the asset detail page (#10) and any later surface can
 * mount the same section with one line.
 *
 * A soft-deleted or missing asset renders nothing rather than an error: the
 * page around it has already decided what to do about that.
 */
export async function AssetPhotoSection({
  assetId,
}: Readonly<{ readonly assetId: string }>) {
  const context = await findAssetPhotoContext(assetId);
  if (!context) {
    return null;
  }

  return (
    <PhotoManager
      assetId={assetId}
      assetName={context.assetName}
      categoryName={context.categoryName}
      photos={context.photos}
    />
  );
}
