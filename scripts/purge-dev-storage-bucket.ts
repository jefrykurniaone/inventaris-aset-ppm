/**
 * Empties the development photo bucket.
 *
 * This exists because photo rows and photo objects reset independently
 * (ADR 0005): the rows live in local PostgreSQL and `prisma migrate reset`
 * wipes them, while the objects live in the cloud and survive. Both buckets
 * draw on one organisation-wide free-tier allowance, so the orphans left
 * behind are not free. This script is the entire mitigation and it is
 * deliberately manual — a reconciliation job would be over-engineering at
 * sixty assets.
 *
 * Run it with:
 *
 *     npm run storage:purge:dev
 *
 * It refuses to run against any bucket but `asset-photos-dev`. One Supabase
 * project holds both buckets and therefore one service-role key, so the key
 * this machine has can empty the deployment bucket as easily as this one;
 * `assertDevelopmentStorageBucket` is what stands between the two, and
 * `src/lib/storage.test.ts` asserts the refusal.
 *
 * The process exits on its own. A non-zero exit code means nothing was
 * deleted.
 */
import { describeError } from "@/lib/log-error";
import {
  assertDevelopmentStorageBucket,
  getObjectStorage,
  getStorageBucket,
} from "@/lib/storage";

const DEV_ENV_FILE = ".env.local";

function loadDevEnv(): void {
  try {
    process.loadEnvFile(DEV_ENV_FILE);
  } catch (error) {
    console.info(
      `purge-dev-storage-bucket: ${DEV_ENV_FILE} not loaded (${describeError(error)}); using the ambient environment.`,
    );
  }
}

async function main(): Promise<void> {
  loadDevEnv();

  const bucket = getStorageBucket();
  assertDevelopmentStorageBucket(bucket);

  const storage = getObjectStorage();
  const objectPaths = await storage.listObjectPaths("");

  if (objectPaths.length === 0) {
    console.info(`purge-dev-storage-bucket: "${bucket}" is already empty.`);
    return;
  }

  await storage.deleteObjects(objectPaths);
  console.info(
    `purge-dev-storage-bucket: deleted ${objectPaths.length} object(s) from "${bucket}".`,
  );

  const remaining = await storage.listObjectPaths("");
  if (remaining.length > 0) {
    console.error(
      `purge-dev-storage-bucket: ${remaining.length} object(s) still present after the delete.`,
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`purge-dev-storage-bucket stopped: ${describeError(error)}`);
  process.exitCode = 1;
});
