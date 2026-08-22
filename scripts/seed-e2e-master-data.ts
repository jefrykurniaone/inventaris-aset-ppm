/**
 * Seeds the minimum master data the Playwright smoke path needs: one active
 * `Category`, one active `Building`, and one active `Room` in that building
 * (issue #70).
 *
 * `prisma/seed.ts` seeds only the first administrator — the wider
 * demonstration dataset (categories, buildings, rooms, funding sources, sixty
 * assets, photos, loans, activity) is issue #16's, and this script is
 * deliberately not that. It exists because the CI `e2e` job boots an
 * ephemeral, empty Postgres database, and the specs' `createAsset` helper
 * (`REQUIRED_SELECT_FIELDS = ["categoryId", "roomId", "condition"]` in
 * `e2e/photo-upload.spec.ts` and `e2e/label-printing.spec.ts`) picks the
 * first real option of each required picker on the asset create form. With
 * no `Category` and no `Room` to offer, both pickers render only their
 * placeholder option and the specs hang until Playwright's 180s timeout.
 * `condition` needs no seed: it is a fixed enumeration (`prisma/models/
 * enums.prisma`), not admin-editable master data.
 *
 * Run it with:
 *
 *     npm run db:seed:e2e-master-data
 *
 * The process exits on its own. A non-zero exit code means nothing was
 * written.
 *
 * ## Local safeguard
 *
 * Same as `prisma/seed.ts`: `decideSeedTarget` from `src/lib/seed-admin`
 * refuses a non-local `DATABASE_URL` unless `SEED_ALLOW_REMOTE=true`, so this
 * script cannot seed a deployment by accident.
 *
 * ## Idempotency
 *
 * Keyed on each row's unique `code` (the `Room` on `[buildingId, code]`, per
 * `prisma/models/master-data.prisma`), never on row count — a developer's
 * local database already carries its own master data, and this script must
 * coexist with it rather than assume an empty table. An existing row of any
 * of the three is left untouched, and the second run says so, so a rerun
 * that changes nothing is distinguishable from a rerun that silently did
 * nothing.
 */
import { decideSeedTarget, ALLOW_REMOTE_ENV } from "@/lib/seed-admin";

/** Development environment file. Prisma does not load it by itself. */
const DEV_ENV_FILE = ".env.local";

const EXIT_REFUSED = 1;
const SCRIPT_NAME = "scripts/seed-e2e-master-data.ts";

/** Distinct from any code the demonstration dataset (issue #16) is likely to
 * pick, so the two never collide once that dataset lands. */
const CATEGORY_CODE = "E2E";
const CATEGORY_NAME = "Kategori E2E";
const CATEGORY_NAME_EN = "E2E Category";

const BUILDING_CODE = "E2E";
const BUILDING_NAME = "Gedung E2E";

const ROOM_CODE = "E2E-1";
const ROOM_NAME = "Ruang E2E";

type Db = (typeof import("@/lib/db"))["db"];

function loadDevEnv(): void {
  try {
    process.loadEnvFile(DEV_ENV_FILE);
  } catch {
    // Absent in CI, where the variables are already set.
    console.info(
      `${SCRIPT_NAME}: ${DEV_ENV_FILE} not loaded; using the ambient environment.`,
    );
  }
}

function refuse(lines: readonly string[]): never {
  for (const line of lines) {
    console.error(`${SCRIPT_NAME}: ${line}`);
  }
  process.exit(EXIT_REFUSED);
}

/** Creates the `Category`, or reports that it is already there. */
async function ensureCategory(db: Db): Promise<string> {
  const existing = await db.category.findUnique({
    where: { code: CATEGORY_CODE },
    select: { id: true },
  });
  if (existing) {
    return `category "${CATEGORY_CODE}" already exists; nothing changed.`;
  }
  await db.category.create({
    data: {
      code: CATEGORY_CODE,
      name: CATEGORY_NAME,
      nameEn: CATEGORY_NAME_EN,
    },
  });
  return `created category "${CATEGORY_CODE}".`;
}

/** Creates the `Building`, or reports that it is already there. Returns its
 * id either way, since `ensureRoom` needs it. */
async function ensureBuilding(
  db: Db,
): Promise<{ id: string; message: string }> {
  const existing = await db.building.findUnique({
    where: { code: BUILDING_CODE },
    select: { id: true },
  });
  if (existing) {
    return {
      id: existing.id,
      message: `building "${BUILDING_CODE}" already exists; nothing changed.`,
    };
  }
  const created = await db.building.create({
    data: { code: BUILDING_CODE, name: BUILDING_NAME },
  });
  return { id: created.id, message: `created building "${BUILDING_CODE}".` };
}

/** Creates the `Room` in `buildingId`, or reports that it is already there. */
async function ensureRoom(db: Db, buildingId: string): Promise<string> {
  const existing = await db.room.findUnique({
    where: { buildingId_code: { buildingId, code: ROOM_CODE } },
    select: { id: true },
  });
  if (existing) {
    return `room "${ROOM_CODE}" in building "${BUILDING_CODE}" already exists; nothing changed.`;
  }
  await db.room.create({
    data: { buildingId, code: ROOM_CODE, name: ROOM_NAME },
  });
  return `created room "${ROOM_CODE}" in building "${BUILDING_CODE}".`;
}

async function main(): Promise<void> {
  loadDevEnv();

  const target = decideSeedTarget(process.env);
  if (!target.ok) {
    refuse([target.reason, "Nothing was written."]);
  }
  if (target.isRemote) {
    console.warn(
      `${SCRIPT_NAME}: seeding a NON-LOCAL database, because ${ALLOW_REMOTE_ENV}=true.`,
    );
  }

  const { db } = await import("@/lib/db");

  const categoryOutcome = await ensureCategory(db);
  const buildingOutcome = await ensureBuilding(db);
  const roomOutcome = await ensureRoom(db, buildingOutcome.id);

  console.info(`${SCRIPT_NAME}: ${categoryOutcome}`);
  console.info(`${SCRIPT_NAME}: ${buildingOutcome.message}`);
  console.info(`${SCRIPT_NAME}: ${roomOutcome}`);

  await db.$disconnect();
}

// `main().catch(...)` rather than a top-level `await`, matching the scripts
// in `scripts/`. The package is CommonJS, so tsx's esbuild transform rejects
// top-level await outright: "Top-level await is currently not supported with
// the cjs output format".
main().catch((error: unknown) => {
  console.error(`${SCRIPT_NAME}: seeding failed. Nothing was written.`);
  console.error(error);
  process.exitCode = 1;
});
