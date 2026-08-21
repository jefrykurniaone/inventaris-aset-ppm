/**
 * Verification script for the application schema (issue #3).
 *
 * Two of that ticket's acceptance criteria are claims about the *database*, not
 * about the schema file, so reading `prisma/schema.prisma` cannot settle either
 * one:
 *
 *   1. At most one primary photo per asset (FR-4.1). The rule is carried by a
 *      partial unique index written by hand into the migration, because
 *      Prisma's schema language can only express an index predicate behind a
 *      preview feature this project does not enable. Nothing in the schema
 *      file mentions it.
 *   2. Master data referenced by an asset cannot be deleted (FR-3.4). The
 *      schema says `onDelete: Restrict`, but whether the emitted foreign key
 *      actually refuses the delete is a property of the applied migration.
 *
 * So both are exercised against the real local PostgreSQL database, through
 * the `src/lib/db.ts` seam, and both are expected to be *rejected*.
 *
 * Run it with:
 *
 *     npx tsx scripts/verify-application-schema.ts
 *
 * The process exits on its own. A non-zero exit code means at least one of the
 * two operations was accepted, which would mean the constraint is missing. The
 * script creates its own fixtures, removes them before and after the run, and
 * is safe to run repeatedly.
 */

/** Development environment file. Prisma does not load it by itself. */
const DEV_ENV_FILE = ".env.local";

/**
 * Fixture identifiers are fixed rather than random so that clean-up is exact
 * and a run interrupted half-way leaves nothing a later run cannot remove.
 */
const FIXTURE_PREFIX = "schema-check-";
const USER_ID = `${FIXTURE_PREFIX}user`;
const CATEGORY_ID = `${FIXTURE_PREFIX}category`;
const BUILDING_ID = `${FIXTURE_PREFIX}building`;
const ROOM_ID = `${FIXTURE_PREFIX}room`;
const ASSET_ID = `${FIXTURE_PREFIX}asset`;
const FIRST_PHOTO_ID = `${FIXTURE_PREFIX}photo-first`;
const SECOND_PHOTO_ID = `${FIXTURE_PREFIX}photo-second`;
const THIRD_PHOTO_ID = `${FIXTURE_PREFIX}photo-third`;
const PHOTO_IDS = [FIRST_PHOTO_ID, SECOND_PHOTO_ID, THIRD_PHOTO_ID];

/** `.invalid` is reserved by RFC 2606, so the address never resolves. */
const FIXTURE_EMAIL = "schema-check@example.invalid";

/** Fixture photo geometry, matching the compression target in FR-4.3. */
const PHOTO_WIDTH = 1600;
const PHOTO_HEIGHT = 1200;
const PHOTO_SIZE_BYTES = 400_000;

const FIXTURE_ACQUISITION_YEAR = 2026;

/**
 * The seam is imported dynamically, so its type is taken from the module rather
 * than from a value in scope. Type positions are erased, so naming the module
 * here does not load it.
 */
type Db = (typeof import("@/lib/db"))["db"];

function loadDevEnv(): void {
  try {
    process.loadEnvFile(DEV_ENV_FILE);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.info(
      `verify-application-schema: ${DEV_ENV_FILE} not loaded (${reason}); using the ambient environment.`,
    );
  }
}

/** Reads the driver or Prisma error code off an unknown thrown value. */
function readErrorCode(error: unknown): string {
  if (error === null || typeof error !== "object" || !("code" in error)) {
    return "(no code)";
  }

  const { code } = error as { code?: unknown };

  return typeof code === "string" ? code : "(no code)";
}

/** Metadata keys Prisma uses to name the constraint that refused an operation. */
const CONSTRAINT_META_KEYS = ["target", "constraint", "field_name"];

function formatConstraint(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Names the refusing constraint, so the proof does not rest on prose alone. */
function readErrorConstraint(error: unknown): string {
  if (error === null || typeof error !== "object" || !("meta" in error)) {
    return "";
  }

  const { meta } = error as { meta?: unknown };

  if (meta === null || typeof meta !== "object") {
    return "";
  }

  const record = meta as Record<string, unknown>;
  const named = CONSTRAINT_META_KEYS.map((key) => record[key]).find(
    (value) => value !== undefined && value !== null,
  );

  return named === undefined ? "" : ` on ${formatConstraint(named)}`;
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const cause = message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .at(-1);

  return `${readErrorCode(error)}${readErrorConstraint(error)}: ${cause ?? message}`;
}

/**
 * Removes every fixture row. Ordered child-before-parent so that the very
 * `Restrict` actions under test do not block the clean-up itself.
 */
async function removeFixtures(db: Db): Promise<void> {
  await db.assetPhoto.deleteMany({ where: { id: { in: PHOTO_IDS } } });
  await db.asset.deleteMany({ where: { id: ASSET_ID } });
  await db.room.deleteMany({ where: { id: ROOM_ID } });
  await db.building.deleteMany({ where: { id: BUILDING_ID } });
  await db.category.deleteMany({ where: { id: CATEGORY_ID } });
  await db.user.deleteMany({ where: { id: USER_ID } });
}

/** One user, one category, one building and one room for the asset to sit in. */
async function createMasterData(db: Db): Promise<void> {
  await db.user.create({
    data: { id: USER_ID, name: "Schema Check", email: FIXTURE_EMAIL },
  });
  await db.category.create({
    data: {
      id: CATEGORY_ID,
      code: "SCHK",
      name: "Pemeriksaan Skema",
      nameEn: "Schema Check",
    },
  });
  await db.building.create({
    data: { id: BUILDING_ID, code: "SCHK", name: "Schema Check Building" },
  });
  await db.room.create({
    data: {
      id: ROOM_ID,
      buildingId: BUILDING_ID,
      code: "SCHK-01",
      name: "Schema Check Room",
    },
  });
}

/** Creates one asset with one primary photo, on top of the master data. */
async function createFixtures(db: Db): Promise<void> {
  await createMasterData(db);
  await db.asset.create({
    data: {
      id: ASSET_ID,
      assetCode: "PPM-SCHK-2026-0001",
      name: "Schema Check Asset",
      categoryId: CATEGORY_ID,
      roomId: ROOM_ID,
      condition: "good",
      acquisitionYear: FIXTURE_ACQUISITION_YEAR,
      qrToken: "schemacheck1",
      createdById: USER_ID,
    },
  });
  await db.assetPhoto.create({ data: photoData(FIRST_PHOTO_ID, true) });
}

/** A photo of the fixture asset, uploaded by the fixture user. */
function photoData(id: string, isPrimary: boolean) {
  return {
    id,
    assetId: ASSET_ID,
    url: `assets/${ASSET_ID}/${id}.webp`,
    thumbUrl: `assets/${ASSET_ID}/${id}-thumb.webp`,
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
    sizeBytes: PHOTO_SIZE_BYTES,
    isPrimary,
    uploadedById: USER_ID,
  };
}

/**
 * Runs one operation that the database is expected to refuse. Returns true when
 * it was refused, false when it went through — which is the failure case here.
 */
async function expectRejection(
  label: string,
  operation: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await operation();
  } catch (error) {
    console.info(`PASS: ${label} was rejected — ${describeError(error)}`);
    return true;
  }

  console.error(
    `FAIL: ${label} was accepted by the database, so the constraint is missing.`,
  );
  return false;
}

/**
 * Runs one operation the database is expected to allow. Returns true when it
 * went through. This is the negative control for the partial index: a blanket
 * unique constraint on `assetId` would also refuse a second primary photo, but
 * it would refuse a second *non-primary* photo too, and FR-4.1 allows five.
 */
async function expectAcceptance(
  label: string,
  operation: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await operation();
  } catch (error) {
    console.error(
      `FAIL: ${label} was rejected, so the constraint is too broad — ${describeError(error)}`,
    );
    return false;
  }

  console.info(`PASS: ${label} was accepted.`);
  return true;
}

async function runChecks(db: Db): Promise<boolean> {
  const isSecondNonPrimaryAllowed = await expectAcceptance(
    "a second non-primary photo for the same asset",
    () => db.assetPhoto.create({ data: photoData(SECOND_PHOTO_ID, false) }),
  );

  const isSecondPrimaryRejected = await expectRejection(
    "a second primary photo for the same asset",
    () => db.assetPhoto.create({ data: photoData(THIRD_PHOTO_ID, true) }),
  );

  const isReferencedCategoryProtected = await expectRejection(
    "deleting a category an asset references",
    () => db.category.delete({ where: { id: CATEGORY_ID } }),
  );

  return (
    isSecondNonPrimaryAllowed &&
    isSecondPrimaryRejected &&
    isReferencedCategoryProtected
  );
}

async function main(): Promise<void> {
  // The seam reads its environment when it is first imported, so the
  // environment file has to be in place before the import is evaluated.
  loadDevEnv();
  const { db } = await import("@/lib/db");

  try {
    await removeFixtures(db);
    await createFixtures(db);
    const hasPassed = await runChecks(db);

    if (hasPassed) {
      console.info(
        "PASS: the one-primary-photo index and the master-data restriction are both enforced by PostgreSQL.",
      );
    } else {
      process.exitCode = 1;
    }
  } finally {
    await removeFixtures(db);
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    `FAIL: verify-application-schema stopped: ${describeError(error)}`,
  );
  process.exitCode = 1;
});
