/**
 * Verification script for the master-data rules added by issue #6.
 *
 * Three things can only be shown against the real development database and
 * the real Better Auth role model, not read off the source:
 *
 *   1. A referenced `Category`'s `code` cannot change (PRD FR-3.2), because
 *      `updateCategory` (`src/app/(app)/admin/categories/mutations.ts`)
 *      checks the live `Asset` count, not a disabled form field. The same
 *      category's `name`/`nameEn` can still change, and an *unreferenced*
 *      category's `code` can still change — so the run also proves the
 *      rule is exactly "code change while referenced", not "no edits at
 *      all once referenced".
 *   2. A referenced `Category`, `Building`, `Room`, and `FundingSource`
 *      each refuse a direct delete (PRD FR-3.4) — the database's own
 *      `onDelete: Restrict` foreign keys, mapped by each `deleteXxx`
 *      function to a `REFERENCED` result rather than a raw `P2003`. An
 *      unreferenced row of the same kind is deletable, which is the
 *      negative control proving the block is about the reference, not the
 *      table.
 *   3. A staff-role session is distinguishable from an admin-role session
 *      at the exact point `requireAdmin()` (`src/lib/require-user.ts`)
 *      branches on. `requireAdmin()` itself cannot be called from a plain
 *      script — it calls `headers()` from `next/headers`, which throws
 *      "called outside a request scope" outside the Next.js server
 *      runtime — so this script exercises the same `auth.api.getSession`
 *      primitive `requireAdmin()` is built on, the way
 *      `scripts/verify-admin-role-model.ts` already does for issue #4.
 *      The "a direct server action call from a staff session is refused"
 *      half of the acceptance criteria is proven instead by every
 *      `actions.test.ts` in `src/app/(app)/admin/**`, which mocks
 *      `requireAdmin` to reject and asserts the underlying mutation is
 *      never called — see `npm run test`.
 *
 * Run it with:
 *
 *     npx tsx scripts/verify-master-data-rules.ts
 *
 * The process exits on its own. A non-zero exit code means at least one
 * rule did not hold. The script creates its own fixtures, removes them
 * before and after the run, and is safe to run repeatedly.
 */
import { randomBytes } from "node:crypto";

import { describeError } from "@/lib/log-error";

const DEV_ENV_FILE = ".env.local";
const FIXTURE_PREFIX = "mdck-";
const PASSWORD_BYTES = 24;
const FIRST_COOKIE_ATTRIBUTE = ";";
const FIXTURE_ACQUISITION_YEAR = 2026;

const USER_ID = `${FIXTURE_PREFIX}user`;
const FIXTURE_EMAIL = "master-data-check@example.invalid";

const CATEGORY_ID = `${FIXTURE_PREFIX}category-ref`;
const UNREF_CATEGORY_ID = `${FIXTURE_PREFIX}category-unref`;
const BUILDING_ID = `${FIXTURE_PREFIX}building-ref`;
const EMPTY_BUILDING_ID = `${FIXTURE_PREFIX}building-empty`;
const ROOM_ID = `${FIXTURE_PREFIX}room-ref`;
const UNREF_ROOM_ID = `${FIXTURE_PREFIX}room-unref`;
const FUNDING_SOURCE_ID = `${FIXTURE_PREFIX}funding-ref`;
const UNREF_FUNDING_SOURCE_ID = `${FIXTURE_PREFIX}funding-unref`;
const ASSET_ID = `${FIXTURE_PREFIX}asset`;

const ADMIN_EMAIL = "mdck-admin@example.invalid";
const STAFF_EMAIL = "mdck-staff@example.invalid";
const ROLE_FIXTURE_EMAILS = [ADMIN_EMAIL, STAFF_EMAIL];

type Db = (typeof import("@/lib/db"))["db"];
type Auth = (typeof import("@/lib/auth"))["auth"];
type CategoryMutations =
  typeof import("../src/app/(app)/admin/categories/mutations");
type BuildingMutations =
  typeof import("../src/app/(app)/admin/buildings/mutations");
type RoomMutations = typeof import("../src/app/(app)/admin/rooms/mutations");
type FundingSourceMutations =
  typeof import("../src/app/(app)/admin/funding-sources/mutations");

function loadDevEnv(): void {
  try {
    process.loadEnvFile(DEV_ENV_FILE);
  } catch (error) {
    const reason = describeError(error);
    console.info(
      `verify-master-data-rules: ${DEV_ENV_FILE} not loaded (${reason}); using the ambient environment.`,
    );
  }
}

function freshPassword(): string {
  return randomBytes(PASSWORD_BYTES).toString("base64url");
}

function report(label: string, isPass: boolean, detail: string): boolean {
  console.info(`${isPass ? "PASS" : "FAIL"}: ${label} — ${detail}`);
  return isPass;
}

/** Removes every fixture row, child-before-parent so the very `Restrict`
 * relations under test do not block the clean-up itself. Safe to call
 * before the run (leftover from an interrupted earlier run) and after. */
async function removeFixtures(db: Db): Promise<void> {
  await db.asset.deleteMany({ where: { id: ASSET_ID } });
  await db.room.deleteMany({ where: { id: { in: [ROOM_ID, UNREF_ROOM_ID] } } });
  await db.building.deleteMany({
    where: { id: { in: [BUILDING_ID, EMPTY_BUILDING_ID] } },
  });
  await db.category.deleteMany({
    where: { id: { in: [CATEGORY_ID, UNREF_CATEGORY_ID] } },
  });
  await db.fundingSource.deleteMany({
    where: { id: { in: [FUNDING_SOURCE_ID, UNREF_FUNDING_SOURCE_ID] } },
  });
  await db.user.deleteMany({ where: { id: USER_ID } });
  await db.user.deleteMany({ where: { email: { in: ROLE_FIXTURE_EMAILS } } });
}

async function createFixtures(db: Db): Promise<void> {
  await db.user.create({
    data: { id: USER_ID, name: "Master Data Check", email: FIXTURE_EMAIL },
  });
  await db.category.create({
    data: {
      id: CATEGORY_ID,
      code: "MDCR",
      name: "Referensi",
      nameEn: "Referenced",
    },
  });
  await db.category.create({
    data: {
      id: UNREF_CATEGORY_ID,
      code: "MDCU",
      name: "Tanpa Referensi",
      nameEn: "Unreferenced",
    },
  });
  await db.building.create({
    data: { id: BUILDING_ID, code: "MDBR", name: "Gedung Referensi" },
  });
  await db.building.create({
    data: { id: EMPTY_BUILDING_ID, code: "MDBE", name: "Gedung Kosong" },
  });
  await db.room.create({
    data: {
      id: ROOM_ID,
      buildingId: BUILDING_ID,
      code: "R1",
      name: "Ruang Referensi",
    },
  });
  await db.room.create({
    data: {
      id: UNREF_ROOM_ID,
      buildingId: BUILDING_ID,
      code: "R2",
      name: "Ruang Kosong",
    },
  });
  await db.fundingSource.create({
    data: { id: FUNDING_SOURCE_ID, name: `${FIXTURE_PREFIX}funding-ref-name` },
  });
  await db.fundingSource.create({
    data: {
      id: UNREF_FUNDING_SOURCE_ID,
      name: `${FIXTURE_PREFIX}funding-unref-name`,
    },
  });
  await db.asset.create({
    data: {
      id: ASSET_ID,
      assetCode: "PPM-MDCR-2026-0001",
      name: "Master Data Check Asset",
      categoryId: CATEGORY_ID,
      roomId: ROOM_ID,
      fundingSourceId: FUNDING_SOURCE_ID,
      condition: "good",
      acquisitionYear: FIXTURE_ACQUISITION_YEAR,
      qrToken: "mdckverify01",
      createdById: USER_ID,
    },
  });
}

/** Rule 1: a referenced category's `code` cannot change, but its other
 * fields can, and an unreferenced category's `code` can. */
async function checkCategoryCodeImmutability(
  categoryMutations: CategoryMutations,
): Promise<boolean> {
  const blockedChange = await categoryMutations.updateCategory(CATEGORY_ID, {
    code: "MDCZ",
    name: "Referensi",
    nameEn: "Referenced",
  });
  const isCodeChangeBlocked = report(
    "changing a referenced category's code",
    !blockedChange.ok && blockedChange.reason === "CODE_IMMUTABLE",
    JSON.stringify(blockedChange),
  );

  const sameCodeEdit = await categoryMutations.updateCategory(CATEGORY_ID, {
    code: "MDCR",
    name: "Referensi (diubah)",
    nameEn: "Referenced (edited)",
  });
  const isNonCodeEditAllowed = report(
    "editing a referenced category's name without changing its code",
    sameCodeEdit.ok,
    JSON.stringify(sameCodeEdit),
  );

  const unrefChange = await categoryMutations.updateCategory(
    UNREF_CATEGORY_ID,
    {
      code: "MDCX",
      name: "Tanpa Referensi",
      nameEn: "Unreferenced",
    },
  );
  const isUnreferencedCodeChangeAllowed = report(
    "changing an unreferenced category's code",
    unrefChange.ok,
    JSON.stringify(unrefChange),
  );

  return (
    isCodeChangeBlocked &&
    isNonCodeEditAllowed &&
    isUnreferencedCodeChangeAllowed
  );
}

/** Rule 2: each referenced master-data row refuses a direct delete; each
 * unreferenced row of the same kind is deletable (the negative control). */
async function checkDeleteRestrictions(
  categoryMutations: CategoryMutations,
  buildingMutations: BuildingMutations,
  roomMutations: RoomMutations,
  fundingSourceMutations: FundingSourceMutations,
): Promise<boolean> {
  const categoryDelete = await categoryMutations.deleteCategory(CATEGORY_ID);
  const isCategoryProtected = report(
    "deleting a category an asset references",
    !categoryDelete.ok && categoryDelete.reason === "REFERENCED",
    JSON.stringify(categoryDelete),
  );

  const buildingDelete = await buildingMutations.deleteBuilding(BUILDING_ID);
  const isBuildingProtected = report(
    "deleting a building that still has rooms",
    !buildingDelete.ok && buildingDelete.reason === "REFERENCED",
    JSON.stringify(buildingDelete),
  );

  const roomDelete = await roomMutations.deleteRoom(ROOM_ID);
  const isRoomProtected = report(
    "deleting a room an asset sits in",
    !roomDelete.ok && roomDelete.reason === "REFERENCED",
    JSON.stringify(roomDelete),
  );

  const fundingSourceDelete =
    await fundingSourceMutations.deleteFundingSource(FUNDING_SOURCE_ID);
  const isFundingSourceProtected = report(
    "deleting a funding source an asset uses",
    !fundingSourceDelete.ok && fundingSourceDelete.reason === "REFERENCED",
    JSON.stringify(fundingSourceDelete),
  );

  const unrefCategoryDelete =
    await categoryMutations.deleteCategory(UNREF_CATEGORY_ID);
  const isUnrefCategoryDeletable = report(
    "deleting an unreferenced category",
    unrefCategoryDelete.ok,
    JSON.stringify(unrefCategoryDelete),
  );

  const emptyBuildingDelete =
    await buildingMutations.deleteBuilding(EMPTY_BUILDING_ID);
  const isEmptyBuildingDeletable = report(
    "deleting a building with no rooms",
    emptyBuildingDelete.ok,
    JSON.stringify(emptyBuildingDelete),
  );

  const unrefRoomDelete = await roomMutations.deleteRoom(UNREF_ROOM_ID);
  const isUnrefRoomDeletable = report(
    "deleting a room with no assets",
    unrefRoomDelete.ok,
    JSON.stringify(unrefRoomDelete),
  );

  const unrefFundingSourceDelete =
    await fundingSourceMutations.deleteFundingSource(UNREF_FUNDING_SOURCE_ID);
  const isUnrefFundingSourceDeletable = report(
    "deleting an unreferenced funding source",
    unrefFundingSourceDelete.ok,
    JSON.stringify(unrefFundingSourceDelete),
  );

  return (
    isCategoryProtected &&
    isBuildingProtected &&
    isRoomProtected &&
    isFundingSourceProtected &&
    isUnrefCategoryDeletable &&
    isEmptyBuildingDeletable &&
    isUnrefRoomDeletable &&
    isUnrefFundingSourceDeletable
  );
}

function toCookieHeader(responseHeaders: Headers): string {
  return responseHeaders
    .getSetCookie()
    .map((cookie) => cookie.split(FIRST_COOKIE_ATTRIBUTE)[0])
    .join("; ");
}

async function sessionRoleFor(
  auth: Auth,
  email: string,
  password: string,
): Promise<string | null | undefined> {
  const { headers } = await auth.api.signInEmail({
    returnHeaders: true,
    body: { email, password },
  });
  const cookieHeader = toCookieHeader(headers);
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: cookieHeader }),
  });
  return session?.user.role;
}

/**
 * Rule 3: a staff-role session's `role` is not `"admin"` — the exact
 * condition `requireAdmin()` (`src/lib/require-user.ts`) redirects on.
 * `auth.api.createUser` is called with no `headers`/`request`, the
 * "trusted server context" path a bootstrap script relies on, per
 * `scripts/verify-admin-role-model.ts`.
 */
async function checkStaffSessionIsNotAdmin(auth: Auth): Promise<boolean> {
  const adminPassword = freshPassword();
  const staffPassword = freshPassword();

  await auth.api.createUser({
    body: {
      email: ADMIN_EMAIL,
      name: "MDCK Admin Fixture",
      password: adminPassword,
      role: "admin",
    },
  });
  await auth.api.createUser({
    body: {
      email: STAFF_EMAIL,
      name: "MDCK Staff Fixture",
      password: staffPassword,
    },
  });

  const adminRole = await sessionRoleFor(auth, ADMIN_EMAIL, adminPassword);
  const staffRole = await sessionRoleFor(auth, STAFF_EMAIL, staffPassword);

  const isAdminRoleAdmin = report(
    "the admin fixture's session role",
    adminRole === "admin",
    `role=${String(adminRole)}`,
  );
  const isStaffRoleNotAdmin = report(
    "the staff fixture's session role — the input requireAdmin() refuses on",
    staffRole !== "admin",
    `role=${String(staffRole)}`,
  );

  return isAdminRoleAdmin && isStaffRoleNotAdmin;
}

async function main(): Promise<void> {
  loadDevEnv();
  const { db } = await import("@/lib/db");
  const { auth } = await import("@/lib/auth");
  const categoryMutations: CategoryMutations =
    await import("../src/app/(app)/admin/categories/mutations");
  const buildingMutations: BuildingMutations =
    await import("../src/app/(app)/admin/buildings/mutations");
  const roomMutations: RoomMutations =
    await import("../src/app/(app)/admin/rooms/mutations");
  const fundingSourceMutations: FundingSourceMutations =
    await import("../src/app/(app)/admin/funding-sources/mutations");

  try {
    await removeFixtures(db);
    await createFixtures(db);

    const isCodeImmutabilityHeld =
      await checkCategoryCodeImmutability(categoryMutations);
    const isDeleteRestrictionHeld = await checkDeleteRestrictions(
      categoryMutations,
      buildingMutations,
      roomMutations,
      fundingSourceMutations,
    );
    const isStaffSessionDistinguished = await checkStaffSessionIsNotAdmin(auth);

    if (
      isCodeImmutabilityHeld &&
      isDeleteRestrictionHeld &&
      isStaffSessionDistinguished
    ) {
      console.info(
        "PASS: category code immutability, delete restrictions, and the staff/admin session role split all hold.",
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
    `FAIL: verify-master-data-rules stopped: ${describeError(error)}`,
  );
  process.exitCode = 1;
});
