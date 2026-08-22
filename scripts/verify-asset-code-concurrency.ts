/**
 * Verification script for the asset code generator added by issue #7, in the
 * style of `scripts/verify-master-data-rules.ts`.
 *
 * The property under test cannot be shown by a Vitest unit test: `npm run
 * test` runs in a `node` environment with no database (`vitest.config.mts`),
 * and what is being claimed is a *database* guarantee — a transaction-scoped
 * Postgres advisory lock, keyed on the (category, acquisition year)
 * namespace, serialising the read-highest-then-insert inside `createAsset`. A
 * mocked Prisma client would prove only that the mock was called.
 *
 * Shown here, against the real local development database: that many
 * simultaneous creates in one category and year produce a contiguous run of
 * codes and no duplicate (PRD FR-2.1); that the sequence restarts at 0001 for
 * a second category and for a second year; that a soft-deleted asset does not
 * free its number for reuse, because its printed label outlives the row; that
 * every `qrToken` is a distinct 12-character nanoid (FR-2.2); and that every
 * mutation left its activity row behind (FR-8.3).
 *
 * Run it with:
 *
 *     npx tsx scripts/verify-asset-code-concurrency.ts
 *
 * The process exits on its own. A non-zero exit code means at least one
 * property did not hold. The script creates its own fixtures, removes them
 * before and after the run, and is safe to run repeatedly.
 */
import { describeError } from "@/lib/log-error";
import { QR_TOKEN_LENGTH } from "@/lib/qr-token";

const DEV_ENV_FILE = ".env.local";
const FIXTURE_PREFIX = "accc-";

const USER_ID = `${FIXTURE_PREFIX}user`;
const FIXTURE_EMAIL = "asset-code-check@example.invalid";
const CATEGORY_ID = `${FIXTURE_PREFIX}category-a`;
const OTHER_CATEGORY_ID = `${FIXTURE_PREFIX}category-b`;
const BUILDING_ID = `${FIXTURE_PREFIX}building`;
const ROOM_ID = `${FIXTURE_PREFIX}room`;

const CATEGORY_CODE = "ACCA";
const OTHER_CATEGORY_CODE = "ACCB";
const YEAR = 2026;
const OTHER_YEAR = 2027;

/** Enough parallel writers that an unsynchronised read-then-insert loses
 * essentially every time, but few enough to stay inside Prisma's default
 * five-second interactive transaction timeout on a laptop. */
const PARALLEL_CREATES = 12;

const URL_SAFE_TOKEN = /^[A-Za-z0-9_-]+$/;

type Db = (typeof import("@/lib/db"))["db"];
type AssetMutations = typeof import("../src/app/(app)/assets/mutations");
type AssetSchemas = typeof import("../src/app/(app)/assets/schemas");
type AssetInput = Parameters<AssetMutations["createAsset"]>[0];

function loadDevEnv(): void {
  try {
    process.loadEnvFile(DEV_ENV_FILE);
  } catch (error) {
    const reason = describeError(error);
    console.info(
      `verify-asset-code-concurrency: ${DEV_ENV_FILE} not loaded (${reason}); using the ambient environment.`,
    );
  }
}

function report(label: string, isPass: boolean, detail: string): boolean {
  console.info(`${isPass ? "PASS" : "FAIL"}: ${label} — ${detail}`);
  return isPass;
}

async function removeFixtures(db: Db): Promise<void> {
  const assetIds = await db.asset.findMany({
    where: { categoryId: { in: [CATEGORY_ID, OTHER_CATEGORY_ID] } },
    select: { id: true },
  });
  const ids = assetIds.map((asset) => asset.id);
  await db.assetActivity.deleteMany({ where: { assetId: { in: ids } } });
  await db.asset.deleteMany({ where: { id: { in: ids } } });
  await db.room.deleteMany({ where: { id: ROOM_ID } });
  await db.building.deleteMany({ where: { id: BUILDING_ID } });
  await db.category.deleteMany({
    where: { id: { in: [CATEGORY_ID, OTHER_CATEGORY_ID] } },
  });
  await db.user.deleteMany({ where: { id: USER_ID } });
}

async function createFixtures(db: Db): Promise<void> {
  await db.user.create({
    data: { id: USER_ID, name: "Asset Code Check", email: FIXTURE_EMAIL },
  });
  await db.category.create({
    data: {
      id: CATEGORY_ID,
      code: CATEGORY_CODE,
      name: "Konkurensi A",
      nameEn: "Concurrency A",
    },
  });
  await db.category.create({
    data: {
      id: OTHER_CATEGORY_ID,
      code: OTHER_CATEGORY_CODE,
      name: "Konkurensi B",
      nameEn: "Concurrency B",
    },
  });
  await db.building.create({
    data: { id: BUILDING_ID, code: "ACCG", name: "Gedung Konkurensi" },
  });
  await db.room.create({
    data: {
      id: ROOM_ID,
      buildingId: BUILDING_ID,
      code: "K1",
      name: "Ruang K1",
    },
  });
}

/** The two modules under test, carried as one argument so the check
 * functions below stay short enough to read. */
interface Subject {
  readonly mutations: AssetMutations;
  readonly schemas: AssetSchemas;
}

function assetInput(
  schemas: AssetSchemas,
  categoryId: string,
  acquisitionYear: number,
  name: string,
): AssetInput {
  return schemas.assetSchema.parse({
    name,
    categoryId,
    roomId: ROOM_ID,
    condition: "good",
    status: "active",
    acquisitionYear: String(acquisitionYear),
  });
}

interface CreatedAsset {
  readonly assetId: string;
  readonly assetCode: string;
}

/** Starts every create before awaiting any of them, so they contend for the
 * same (category, year) namespace inside overlapping transactions. */
async function createInParallel(
  { mutations, schemas }: Subject,
  categoryId: string,
  acquisitionYear: number,
  count: number,
): Promise<readonly CreatedAsset[]> {
  const pending = Array.from({ length: count }, (_unused, index) =>
    mutations.createAsset(
      assetInput(schemas, categoryId, acquisitionYear, `Aset ${index + 1}`),
      USER_ID,
    ),
  );

  const results = await Promise.all(pending);
  const created: CreatedAsset[] = [];
  for (const result of results) {
    if (!result.ok) {
      throw new Error(`createAsset refused the input: ${result.reason}`);
    }
    created.push({ assetId: result.assetId, assetCode: result.assetCode });
  }
  return created;
}

function expectedRun(categoryCode: string, year: number, count: number) {
  return Array.from(
    { length: count },
    (_unused, index) =>
      `PPM-${categoryCode}-${year}-${String(index + 1).padStart(4, "0")}`,
  );
}

function checkNoDuplicates(created: readonly CreatedAsset[]): boolean {
  const codes = created.map((asset) => asset.assetCode);
  const unique = new Set(codes);
  const isUnique = report(
    `${codes.length} simultaneous creates in one category and year produced no duplicate code`,
    unique.size === codes.length,
    `${unique.size} distinct of ${codes.length}`,
  );

  const sorted = [...codes].toSorted();
  const isContiguous = report(
    "the codes form one contiguous run from 0001",
    JSON.stringify(sorted) ===
      JSON.stringify(expectedRun(CATEGORY_CODE, YEAR, codes.length)),
    `${sorted[0]} … ${sorted[sorted.length - 1]}`,
  );

  return isUnique && isContiguous;
}

async function checkNamespaceIsolation(subject: Subject): Promise<boolean> {
  const otherCategory = await createInParallel(
    subject,
    OTHER_CATEGORY_ID,
    YEAR,
    1,
  );
  const otherYear = await createInParallel(subject, CATEGORY_ID, OTHER_YEAR, 1);

  const isCategoryScoped = report(
    "a second category in the same year starts again at 0001",
    otherCategory[0].assetCode === `PPM-${OTHER_CATEGORY_CODE}-${YEAR}-0001`,
    otherCategory[0].assetCode,
  );
  const isYearScoped = report(
    "a second year in the same category starts again at 0001",
    otherYear[0].assetCode === `PPM-${CATEGORY_CODE}-${OTHER_YEAR}-0001`,
    otherYear[0].assetCode,
  );

  return isCategoryScoped && isYearScoped;
}

/** A soft-deleted asset keeps its number: the label it was printed on is
 * still stuck to something, so the next create must skip past it. */
async function checkSoftDeleteKeepsSequence(
  subject: Subject,
  created: readonly CreatedAsset[],
): Promise<boolean> {
  const last = created[created.length - 1];
  const deleted = await subject.mutations.softDeleteAsset(
    last.assetId,
    USER_ID,
  );
  if (!deleted.ok) {
    return report("soft-deleting an asset", false, deleted.reason);
  }

  const next = await createInParallel(subject, CATEGORY_ID, YEAR, 1);
  const expected = expectedRun(CATEGORY_CODE, YEAR, created.length + 1).at(-1);

  return report(
    `a soft-deleted ${last.assetCode} does not free its sequence for reuse`,
    next[0].assetCode === expected,
    `next code ${next[0].assetCode}, expected ${String(expected)}`,
  );
}

async function checkQrTokens(db: Db): Promise<boolean> {
  const assets = await db.asset.findMany({
    where: { categoryId: { in: [CATEGORY_ID, OTHER_CATEGORY_ID] } },
    select: { qrToken: true },
  });
  const tokens = assets.map((asset) => asset.qrToken);

  const isCorrectLength = report(
    `every qrToken is ${QR_TOKEN_LENGTH} characters from the URL alphabet`,
    tokens.every(
      (token) => token.length === QR_TOKEN_LENGTH && URL_SAFE_TOKEN.test(token),
    ),
    `${tokens.length} tokens checked`,
  );
  const isUnique = report(
    "every qrToken issued in this run is distinct",
    new Set(tokens).size === tokens.length,
    `${new Set(tokens).size} distinct of ${tokens.length}`,
  );

  return isCorrectLength && isUnique;
}

async function checkActivityTrail(db: Db): Promise<boolean> {
  const created = await db.assetActivity.count({
    where: { actorId: USER_ID, type: "created" },
  });
  const deleted = await db.assetActivity.count({
    where: { actorId: USER_ID, type: "deleted" },
  });

  const expectedCreated = PARALLEL_CREATES + 3;
  const isCreatedLogged = report(
    "every create wrote one `created` activity row carrying the acting user",
    created === expectedCreated,
    `${created} rows, expected ${expectedCreated}`,
  );
  const isDeleteLogged = report(
    "the soft delete wrote one `deleted` activity row",
    deleted === 1,
    `${deleted} rows`,
  );

  return isCreatedLogged && isDeleteLogged;
}

async function main(): Promise<void> {
  loadDevEnv();
  const { db } = await import("@/lib/db");
  const subject: Subject = {
    mutations: await import("../src/app/(app)/assets/mutations"),
    schemas: await import("../src/app/(app)/assets/schemas"),
  };

  try {
    await removeFixtures(db);
    await createFixtures(db);

    const created = await createInParallel(
      subject,
      CATEGORY_ID,
      YEAR,
      PARALLEL_CREATES,
    );

    const isCollisionFree = checkNoDuplicates(created);
    const isNamespaced = await checkNamespaceIsolation(subject);
    const isSequenceKept = await checkSoftDeleteKeepsSequence(subject, created);
    const areTokensSound = await checkQrTokens(db);
    const isTrailWritten = await checkActivityTrail(db);

    if (
      isCollisionFree &&
      isNamespaced &&
      isSequenceKept &&
      areTokensSound &&
      isTrailWritten
    ) {
      console.info(
        "PASS: asset codes are collision-free under concurrent creation, scoped per category and year, never reused after a soft delete, and every qrToken is a distinct 12-character nanoid.",
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
    `FAIL: verify-asset-code-concurrency stopped: ${describeError(error)}`,
  );
  process.exitCode = 1;
});
