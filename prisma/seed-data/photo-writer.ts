import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { insertPhoto } from "@/app/(app)/assets/photos/mutations";
import { db } from "@/lib/db";
import { inspectPhotoPart } from "@/lib/photo-upload";
import type { SeedAssetPlanItem } from "@/lib/seed-asset-mix";
import { seedPhotoFileNames } from "@/lib/seed-photo-plan";
import type { PhotoContent } from "@/lib/storage";

/**
 * Attaching the ~15 demonstration assets' photos (issue #16's amendment;
 * ADR 0009).
 *
 * The committed images in `prisma/seed-assets/` are already sized to the
 * browser pipeline's output contract — `prisma/seed-assets/CREDITS.md`
 * records how — so what happens here is exactly the server half of a real
 * upload: identify each image from its bytes with the same `inspectPhotoPart`
 * the upload route runs, then `insertPhoto`, which writes the row, the bytes
 * through `src/lib/storage.ts` and the activity in one transaction. Skipping
 * is only the in-browser compression step the committed files stand in for.
 *
 * It needs nothing but the database: no network and no storage credentials.
 *
 * Photo seeding is skipped when `SEED_SKIP_PHOTOS=true` (issue #16 hand-back
 * 1) — an explicit opt-out, for a run that wants the dataset without its
 * photos.
 */

const SEED_ASSETS_DIR = new URL("../seed-assets/", import.meta.url);
const SEED_IMAGE_CONTENT_TYPE = "image/jpeg";

/** The pipeline's own bounds (`src/lib/photo-compression.ts`). The seed
 * images are generated at exactly these dimensions, so they are constants
 * here rather than read out of the file. */
const FULL_IMAGE_WIDTH_PX = 1600;
const FULL_IMAGE_HEIGHT_PX = 1200;

/** Explicit opt-out for a run that wants the dataset without its photos. */
export const SKIP_PHOTOS_ENV = "SEED_SKIP_PHOTOS";
const SKIP_PHOTOS_VALUE = "true";

export function isPhotoSeedingSkipped(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return env[SKIP_PHOTOS_ENV] === SKIP_PHOTOS_VALUE;
}

export interface SeedPhotoWriteInput {
  readonly assetIdBySeedKey: ReadonlyMap<string, string>;
  readonly planBySeedKey: ReadonlyMap<string, SeedAssetPlanItem>;
  readonly actorId: string;
}

function photographedAssets(
  planBySeedKey: ReadonlyMap<string, SeedAssetPlanItem>,
): readonly SeedAssetPlanItem[] {
  return [...planBySeedKey.values()].filter((item) => item.photoCount > 0);
}

interface SeedImage {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: PhotoContent["fullContentType"];
}

/**
 * Reads one committed image and identifies it from its bytes, exactly as the
 * upload route identifies an uploaded part. A committed file that is not what
 * its name says, or has grown past the ceiling, fails the seed loudly rather
 * than being stored.
 */
async function readSeedImage(fileName: string): Promise<SeedImage> {
  const buffer = await readFile(
    fileURLToPath(new URL(fileName, SEED_ASSETS_DIR)),
  );
  // A plain `Uint8Array` copy: Prisma's `Bytes` input is typed over an
  // `ArrayBuffer`, and Node's `Buffer` may sit on a shared pool.
  const bytes = new Uint8Array(buffer);
  const acceptance = inspectPhotoPart({
    declaredType: SEED_IMAGE_CONTENT_TYPE,
    bytes,
  });
  if (!acceptance.isAccepted) {
    throw new Error(
      `prisma/seed-data/photo-writer: "${fileName}" was rejected: ${acceptance.rejection}.`,
    );
  }
  return { bytes, contentType: acceptance.contentType };
}

async function attachOnePhoto(
  assetId: string,
  actorId: string,
  categoryCode: string,
  photoIndex: number,
): Promise<void> {
  const fileNames = seedPhotoFileNames(categoryCode, photoIndex);
  const full = await readSeedImage(fileNames.full);
  const thumb = await readSeedImage(fileNames.thumb);

  const result = await insertPhoto({
    assetId,
    actorId,
    width: FULL_IMAGE_WIDTH_PX,
    height: FULL_IMAGE_HEIGHT_PX,
    content: {
      fullBytes: full.bytes,
      fullContentType: full.contentType,
      thumbBytes: thumb.bytes,
      thumbContentType: thumb.contentType,
    },
  });
  if (!result.ok) {
    throw new Error(
      `prisma/seed-data/photo-writer: could not attach a photo to asset "${assetId}": ${result.reason}.`,
    );
  }
}

async function existingPhotoCount(assetId: string): Promise<number> {
  return db.assetPhoto.count({ where: { assetId } });
}

async function seedPhotosForAsset(
  item: SeedAssetPlanItem,
  assetId: string,
  actorId: string,
): Promise<string> {
  if ((await existingPhotoCount(assetId)) > 0) {
    return `asset "${item.seedKey}" already has photos; nothing changed.`;
  }

  const photoIndices = Array.from({ length: item.photoCount }, (_, i) => i);
  for (const photoIndex of photoIndices) {
    await attachOnePhoto(assetId, actorId, item.categoryCode, photoIndex);
  }
  return `attached ${item.photoCount} photo(s) to asset "${item.seedKey}".`;
}

export async function seedPhotos(
  input: SeedPhotoWriteInput,
  env: Readonly<Record<string, string | undefined>>,
): Promise<readonly string[]> {
  if (isPhotoSeedingSkipped(env)) {
    return [
      `skipped: ${SKIP_PHOTOS_ENV}=true is set. No photos were attached.`,
    ];
  }

  const messages: string[] = [];
  for (const item of photographedAssets(input.planBySeedKey)) {
    const assetId = input.assetIdBySeedKey.get(item.seedKey);
    if (!assetId) {
      throw new Error(
        `prisma/seed-data/photo-writer: no asset id resolved for "${item.seedKey}".`,
      );
    }
    messages.push(await seedPhotosForAsset(item, assetId, input.actorId));
  }
  return messages;
}
