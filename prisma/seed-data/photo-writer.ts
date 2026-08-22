import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { insertPhoto } from "@/app/(app)/assets/photos/mutations";
import { db } from "@/lib/db";
import { acceptPhoto, buildPhotoObjectPath } from "@/lib/photo-upload";
import type { SeedAssetPlanItem } from "@/lib/seed-asset-mix";
import { seedPhotoFileNames } from "@/lib/seed-photo-plan";
import { getObjectStorage } from "@/lib/storage";

/**
 * Attaching the ~15 demonstration assets' photos (issue #16's amendment).
 *
 * The bytes are already sized to the browser pipeline's output contract —
 * `prisma/seed-assets/CREDITS.md` records how — so what happens here is
 * exactly the server half of a real upload: mint a signed target through
 * `src/lib/storage.ts`, `PUT` the bytes, read back what the bucket actually
 * holds with `statObject`, and run the same `acceptPhoto` check
 * `attach-photo.ts` runs, before `insertPhoto` writes the row. Skipping is
 * only the in-browser compression step the amendment says the committed
 * files already stand in for.
 *
 * If the three storage environment variables are not set — the CI `e2e` job
 * has none of them during `npm run db:seed` — this reports the skip and
 * moves on rather than failing the whole seed run.
 */

const SEED_ASSETS_DIR = new URL("../seed-assets/", import.meta.url);
const PHOTO_CONTENT_TYPE = "image/jpeg";

/** The pipeline's own bounds (`src/lib/photo-compression.ts`). The seed
 * images are generated at exactly these dimensions, so they are constants
 * here rather than read out of the file. */
const FULL_IMAGE_WIDTH_PX = 1600;
const FULL_IMAGE_HEIGHT_PX = 1200;

const REQUIRED_STORAGE_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
] as const;

/** Whether object storage is configured at all. Exported so `prisma/seed.ts`
 * can decide, before calling `seedPhotos`, whether to print the skip
 * explanation itself or let this module report it. */
export function hasStorageConfig(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return REQUIRED_STORAGE_ENV.every((name) => Boolean(env[name]));
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

async function readSeedImage(fileName: string): Promise<Buffer> {
  return readFile(fileURLToPath(new URL(fileName, SEED_ASSETS_DIR)));
}

interface UploadedImage {
  readonly objectPath: string;
  readonly sizeBytes: number;
}

/** Uploads one object through the storage seam and verifies what actually
 * landed — the same `statObject` + `acceptPhoto` pair
 * `refuseUnacceptableObjects` in `attach-photo.ts` runs against a real
 * upload. */
async function uploadSeedImage(
  assetId: string,
  fileName: string,
): Promise<UploadedImage> {
  const storage = getObjectStorage();
  const bytes = await readSeedImage(fileName);
  const objectPath = buildPhotoObjectPath(assetId, PHOTO_CONTENT_TYPE);
  const target = await storage.createSignedUploadTarget(objectPath);

  // `fetch`'s DOM typings accept `Uint8Array` but not Node's `Buffer`
  // subtype directly; `Uint8Array.from` copies the bytes into a plain one.
  const response = await fetch(target.signedUrl, {
    method: "PUT",
    headers: { "content-type": PHOTO_CONTENT_TYPE },
    body: Uint8Array.from(bytes),
  });
  if (!response.ok) {
    throw new Error(
      `prisma/seed-data/photo-writer: upload to "${objectPath}" failed with status ${response.status}.`,
    );
  }

  const stored = await storage.statObject(objectPath);
  if (!stored) {
    throw new Error(
      `prisma/seed-data/photo-writer: "${objectPath}" was not found in storage after upload.`,
    );
  }
  const acceptance = acceptPhoto(stored);
  if (!acceptance.isAccepted) {
    throw new Error(
      `prisma/seed-data/photo-writer: "${objectPath}" was rejected: ${acceptance.rejection}.`,
    );
  }
  return { objectPath, sizeBytes: acceptance.sizeBytes };
}

async function attachOnePhoto(
  assetId: string,
  actorId: string,
  categoryCode: string,
  photoIndex: number,
): Promise<void> {
  const fileNames = seedPhotoFileNames(categoryCode, photoIndex);
  const full = await uploadSeedImage(assetId, fileNames.full);
  const thumb = await uploadSeedImage(assetId, fileNames.thumb);

  const result = await insertPhoto({
    assetId,
    actorId,
    objectPath: full.objectPath,
    thumbObjectPath: thumb.objectPath,
    width: FULL_IMAGE_WIDTH_PX,
    height: FULL_IMAGE_HEIGHT_PX,
    sizeBytes: full.sizeBytes,
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
  if (!hasStorageConfig(env)) {
    return [
      "skipped: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_STORAGE_BUCKET is not set. No photos were attached.",
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
