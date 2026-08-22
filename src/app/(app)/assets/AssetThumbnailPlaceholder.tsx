interface AssetThumbnailPlaceholderProps {
  readonly label: string;
}

/**
 * Stands in for a real thumbnail (PRD FR-2.6: "thumbnail per row, never the
 * full image"), rendered by `AssetThumbnail` when an asset has no primary
 * photo.
 */
export function AssetThumbnailPlaceholder({
  label,
}: Readonly<AssetThumbnailPlaceholderProps>) {
  return (
    <div
      role="img"
      aria-label={label}
      className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xs"
    >
      —
    </div>
  );
}
