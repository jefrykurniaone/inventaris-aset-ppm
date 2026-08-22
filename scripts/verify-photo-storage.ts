/**
 * Verification script for the photo pipeline added by issue #9.
 *
 * Seven things can only be shown against the real `asset-photos-dev` bucket,
 * not read off the source:
 *
 *   1. The service-role key mints a signed upload URL through
 *      `src/lib/storage.ts` (PRD FR-4.4).
 *   2. A browser-shaped `PUT` to that URL — no Supabase client, just the
 *      transport `src/app/(app)/assets/photos/upload-to-signed-url.ts` uses —
 *      is accepted, so image bytes never pass through a function.
 *   3. `statObject` reports the object's real size and content type, which is
 *      what makes the 1.5 MB cap and the allowlist a control rather than a
 *      restatement of what the client claimed (FR-4.6).
 *   4. The object reads back over its public URL with no credentials, byte
 *      identical, which is what the scan page depends on (FR-4.10).
 *   5. An object of a type outside the allowlist is refused by the bucket
 *      itself, the backstop behind the server-side check.
 *   6. `deleteObjects` removes the object.
 *   7. A recursive `listObjectPaths` finds an object nested two folders deep,
 *      which is what the purge script walks.
 *
 * Run it with:
 *
 *     npx tsx scripts/verify-photo-storage.ts
 *
 * The process exits on its own. A non-zero exit code means at least one step
 * did not hold. Everything it creates lives under one throwaway prefix and is
 * removed before and after the run, so it is safe to run repeatedly. It never
 * touches the deployment bucket: the first check is the same refusal the purge
 * script makes.
 */
import { nanoid } from "nanoid";

import { describeError } from "@/lib/log-error";
import {
  assertDevelopmentStorageBucket,
  getObjectStorage,
  getStorageBucket,
  type ObjectStorage,
} from "@/lib/storage";

const DEV_ENV_FILE = ".env.local";
const FIXTURE_ASSET_ID = "photo-storage-check";
const FIXTURE_PREFIX = `assets/${FIXTURE_ASSET_ID}`;
const WEBP_CONTENT_TYPE = "image/webp";
const DISALLOWED_CONTENT_TYPE = "image/gif";
const HTTP_OK = 200;
const OBJECT_ID_LENGTH = 16;

/** The smallest valid lossy WebP: a 1x1 pixel, as base64. Real bytes rather
 * than a text blob, so the bucket's own MIME sniffing has something to agree
 * with. */
const ONE_PIXEL_WEBP_BASE64 =
  "UklGRhwAAABXRUJQVlA4TA8AAAAvAAAAAAfQ//73v/+BiOh/AAA=";

function loadDevEnv(): void {
  try {
    process.loadEnvFile(DEV_ENV_FILE);
  } catch (error) {
    console.info(
      `verify-photo-storage: ${DEV_ENV_FILE} not loaded (${describeError(error)}); using the ambient environment.`,
    );
  }
}

function report(label: string, isPass: boolean, detail: string): boolean {
  console.info(`${isPass ? "PASS" : "FAIL"}: ${label} — ${detail}`);
  return isPass;
}

function fixturePath(extension: string): string {
  return `${FIXTURE_PREFIX}/${nanoid(OBJECT_ID_LENGTH)}.${extension}`;
}

/** `Uint8Array<ArrayBuffer>`, not the bare `Uint8Array`: the bare form is
 * backed by `ArrayBufferLike`, which `BlobPart` does not accept because it
 * admits a `SharedArrayBuffer`. Copying into a fresh array fixes the backing
 * type without a cast. */
function pixelBytes(): Uint8Array<ArrayBuffer> {
  const decoded = Buffer.from(ONE_PIXEL_WEBP_BASE64, "base64");
  const bytes = new Uint8Array(decoded.byteLength);
  bytes.set(decoded);
  return bytes;
}

/** The browser's transport, reproduced with `fetch`: a `PUT` of the raw bytes
 * to the signed URL, carrying nothing but a content type. */
async function putToSignedUrl(
  signedUrl: string,
  body: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<number> {
  // A `Blob`, not the raw `Uint8Array`: `fetch`'s `BodyInit` does not accept a
  // typed array directly, and the browser transport this stands in for sends a
  // `Blob` too.
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: new Blob([body], { type: contentType }),
  });
  return response.status;
}

async function removeEverything(storage: ObjectStorage): Promise<void> {
  const leftovers = await storage.listObjectPaths(FIXTURE_PREFIX);
  await storage.deleteObjects(leftovers);
}

async function checkRoundTrip(storage: ObjectStorage): Promise<boolean> {
  const objectPath = fixturePath("webp");
  const bytes = pixelBytes();

  const target = await storage.createSignedUploadTarget(objectPath);
  const isSigned = report(
    "minting a signed upload URL with the service-role key",
    target.signedUrl.length > 0 && target.objectPath === objectPath,
    `objectPath=${target.objectPath}`,
  );

  const status = await putToSignedUrl(
    target.signedUrl,
    bytes,
    WEBP_CONTENT_TYPE,
  );
  const isUploaded = report(
    "uploading straight to storage with a plain PUT, no Supabase client",
    status === HTTP_OK,
    `status=${status}`,
  );

  const stored = await storage.statObject(objectPath);
  const isStatCorrect = report(
    "reading the stored object's real size and content type back",
    stored?.sizeBytes === bytes.byteLength &&
      stored.contentType === WEBP_CONTENT_TYPE,
    JSON.stringify(stored),
  );

  const isPublic = await checkPublicRead(storage, objectPath, bytes);
  const isListed = await checkRecursiveListing(storage, objectPath);
  const isDeleted = await checkDelete(storage, objectPath);

  return (
    isSigned && isUploaded && isStatCorrect && isPublic && isListed && isDeleted
  );
}

async function checkPublicRead(
  storage: ObjectStorage,
  objectPath: string,
  expected: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  const publicUrl = storage.getPublicUrl(objectPath);
  const response = await fetch(`${publicUrl}?cachebust=${nanoid()}`);
  const received = new Uint8Array(await response.arrayBuffer());
  return report(
    "reading the object back over its public URL with no credentials",
    response.status === HTTP_OK &&
      Buffer.from(received).equals(Buffer.from(expected)),
    `status=${response.status} bytes=${received.byteLength}`,
  );
}

async function checkRecursiveListing(
  storage: ObjectStorage,
  objectPath: string,
): Promise<boolean> {
  const paths = await storage.listObjectPaths("assets");
  return report(
    "walking folders recursively, the way the purge script does",
    paths.includes(objectPath),
    `found ${paths.length} object(s) under "assets"`,
  );
}

async function checkDelete(
  storage: ObjectStorage,
  objectPath: string,
): Promise<boolean> {
  await storage.deleteObjects([objectPath]);
  const stored = await storage.statObject(objectPath);
  return report(
    "deleting the object, so no row can be left pointing at nothing",
    stored === null,
    `statObject=${JSON.stringify(stored)}`,
  );
}

/** The bucket's own allowed-MIME list is the backstop behind the server-side
 * allowlist. An upload declaring a type outside it must not succeed. */
async function checkDisallowedTypeRefused(
  storage: ObjectStorage,
): Promise<boolean> {
  const objectPath = fixturePath("gif");
  const target = await storage.createSignedUploadTarget(objectPath);
  const status = await putToSignedUrl(
    target.signedUrl,
    pixelBytes(),
    DISALLOWED_CONTENT_TYPE,
  );
  const isRefused = status !== HTTP_OK;
  if (!isRefused) {
    await storage.deleteObjects([objectPath]);
  }
  return report(
    `uploading ${DISALLOWED_CONTENT_TYPE}, which the bucket must refuse`,
    isRefused,
    `status=${status}`,
  );
}

async function main(): Promise<void> {
  loadDevEnv();

  const bucket = getStorageBucket();
  assertDevelopmentStorageBucket(bucket);
  console.info(`verify-photo-storage: running against "${bucket}".`);

  const storage = getObjectStorage();
  try {
    await removeEverything(storage);

    const isRoundTripHeld = await checkRoundTrip(storage);
    const isTypeRefused = await checkDisallowedTypeRefused(storage);

    if (isRoundTripHeld && isTypeRefused) {
      console.info(
        "PASS: signed upload, direct PUT, stat, public read, recursive listing, delete, and the bucket's type refusal all hold.",
      );
    } else {
      process.exitCode = 1;
    }
  } finally {
    await removeEverything(storage);
  }
}

main().catch((error: unknown) => {
  console.error(`FAIL: verify-photo-storage stopped: ${describeError(error)}`);
  process.exitCode = 1;
});
