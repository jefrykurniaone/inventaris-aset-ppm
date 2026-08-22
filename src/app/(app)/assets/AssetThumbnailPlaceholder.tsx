interface AssetThumbnailPlaceholderProps {
  readonly label: string;
}

/**
 * Stands in for a real thumbnail (PRD FR-2.6: "thumbnail per row, never the
 * full image"). The photo pipeline is issue #9, being built in parallel
 * right now, so no `AssetPhoto` row can be rendered from here yet.
 *
 * TODO(#9): once the photo pipeline merges, replace this with the asset's
 * primary photo thumbnail — read only `objectPath`/`thumbObjectPath` off
 * `AssetPhoto` and resolve it through `src/lib/storage.ts`, never a
 * Supabase client imported here directly.
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
