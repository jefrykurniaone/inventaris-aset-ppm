/**
 * Which pre-sized placeholder image variant a demonstration photo uses
 * (issue #16's amendment): two variants per category, `prisma/seed-assets/
 * <categoryCode>-a-full.jpg` and `-b-full.jpg`, each with its own thumbnail.
 *
 * An asset's first photo always uses variant `a`; a second photo (five
 * assets get one) uses `b`, so the two photos on one asset are never
 * byte-identical uploads.
 */

export type SeedPhotoVariant = "a" | "b";

export function seedPhotoVariantFor(photoIndex: number): SeedPhotoVariant {
  return photoIndex === 0 ? "a" : "b";
}

export interface SeedPhotoFileNames {
  readonly full: string;
  readonly thumb: string;
}

export function seedPhotoFileNames(
  categoryCode: string,
  photoIndex: number,
): SeedPhotoFileNames {
  const variant = seedPhotoVariantFor(photoIndex);
  return {
    full: `${categoryCode}-${variant}-full.jpg`,
    thumb: `${categoryCode}-${variant}-thumb.jpg`,
  };
}
