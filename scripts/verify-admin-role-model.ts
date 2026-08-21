/**
 * Verification script for the role model configured in `src/lib/auth.ts`
 * (issue #4). `docs/prd.md` FR-1.2 to FR-1.4 need two roles, `admin` and
 * `staff`, with `staff` as an admin-created account's default and `admin` as
 * the elevated one — and the ticket that added them says to look this up
 * empirically rather than assume it, the same way ADR 0002 resolved the
 * persistence layer.
 *
 * Two things can only be shown against the real library and the real
 * database, not read off the config:
 *
 *   1. `defaultRole: "staff"` actually lands on a user created with no role
 *      given at all (an admin-created account, not `disableSignUp`'s closed
 *      `/sign-up/email`).
 *   2. `adminRoles: ["admin"]`, with `roles.staff` carrying no permissions
 *      in the explicit access-control map `src/lib/auth.ts` configures,
 *      means a `"staff"` caller is refused by the Better Auth admin plugin
 *      itself — independently of `src/lib/require-user.ts`'s own check.
 *
 * Run it with:
 *
 *     npx tsx scripts/verify-admin-role-model.ts
 *
 * The process exits on its own. A non-zero exit code means the role model
 * does not behave as `src/lib/auth.ts` and `src/lib/roles.ts` document. The
 * script creates its own fixtures, removes them before and after the run,
 * and is safe to run repeatedly.
 */
import { randomBytes } from "node:crypto";

/** Development environment file. Better Auth and Prisma do not load it. */
const DEV_ENV_FILE = ".env.local";

/** `.invalid` is reserved by RFC 2606, so neither address ever resolves. */
const ADMIN_EMAIL = "role-model-admin@example.invalid";
const STAFF_EMAIL = "role-model-staff@example.invalid";
const SECOND_STAFF_EMAIL = "role-model-second-staff@example.invalid";
const FIXTURE_EMAILS = [ADMIN_EMAIL, STAFF_EMAIL, SECOND_STAFF_EMAIL];

const ADMIN_NAME = "Role Model Admin Fixture";
const STAFF_NAME = "Role Model Staff Fixture";
const SECOND_STAFF_NAME = "Role Model Second Staff Fixture";

/** A fresh random password per run, so no credential is ever committed. */
const PASSWORD_BYTES = 24;
const FIRST_COOKIE_ATTRIBUTE = ";";

type Auth = (typeof import("@/lib/auth"))["auth"];
type Db = (typeof import("@/lib/db"))["db"];

function loadDevEnv(): void {
  try {
    process.loadEnvFile(DEV_ENV_FILE);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.info(
      `verify-admin-role-model: ${DEV_ENV_FILE} not loaded (${reason}); using the ambient environment.`,
    );
  }
}

function freshPassword(): string {
  return randomBytes(PASSWORD_BYTES).toString("base64url");
}

/** Turns the `Set-Cookie` headers of a response into one request `Cookie` value. */
function toCookieHeader(responseHeaders: Headers): string {
  return responseHeaders
    .getSetCookie()
    .map((cookie) => cookie.split(FIRST_COOKIE_ATTRIBUTE)[0])
    .join("; ");
}

async function signInAndGetCookie(auth: Auth, email: string, password: string) {
  const { headers } = await auth.api.signInEmail({
    returnHeaders: true,
    body: { email, password },
  });
  return toCookieHeader(headers);
}

/**
 * Duck-types a Better Auth `APIError`'s `status`/`message` rather than
 * importing `isAPIError`/`APIError` from the `better-auth` package: this
 * script is not one of the project's two allowed Better Auth import sites
 * (`src/lib/auth.ts`, `src/lib/auth-client.ts`), so it only ever touches the
 * library through the `auth` object those files export.
 */
function readErrorStatus(error: unknown): string | undefined {
  if (error === null || typeof error !== "object" || !("status" in error)) {
    return undefined;
  }
  const { status } = error as { status?: unknown };
  return typeof status === "string" ? status : undefined;
}

function isForbiddenError(error: unknown): boolean {
  return readErrorStatus(error) === "FORBIDDEN";
}

function describeError(error: unknown): string {
  const status = readErrorStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  return status ? `${status}: ${message}` : message;
}

async function removeFixtures(db: Db): Promise<void> {
  const removed = await db.user.deleteMany({
    where: { email: { in: FIXTURE_EMAILS } },
  });
  console.info(`cleared ${removed.count} earlier fixture user row(s).`);
}

/**
 * Creates the admin fixture through `auth.api.createUser` with no `headers`
 * and no explicit role. Per `better-auth@1.7.1`'s admin route, a call with
 * neither `headers` nor `request` skips the permission check entirely — the
 * documented "trusted server context" path a bootstrap script relies on —
 * so this is the same shape of call a first-admin seed would make. The role
 * is set explicitly here because this fixture's job is to *act as* an admin,
 * not to prove the default.
 */
async function createAdminFixture(auth: Auth, password: string) {
  const { user } = await auth.api.createUser({
    body: { email: ADMIN_EMAIL, name: ADMIN_NAME, password, role: "admin" },
  });
  console.info(`created admin fixture   : ${user.id} (role ${user.role})`);
  return user;
}

/**
 * Creates the staff fixture with **no `role` field at all**, so whatever
 * role lands on it is exactly `defaultRole` from `src/lib/auth.ts` — this is
 * the empirical check for point 1 in the file header, not an assumption.
 */
async function createStaffFixtureWithNoRole(auth: Auth, password: string) {
  const { user } = await auth.api.createUser({
    body: { email: STAFF_EMAIL, name: STAFF_NAME, password },
  });
  console.info(`created staff fixture   : ${user.id} (role ${user.role})`);
  return user;
}

async function expectListUsersAllowed(
  auth: Auth,
  cookieHeader: string,
  label: string,
): Promise<boolean> {
  try {
    const result = await auth.api.listUsers({
      query: { limit: 1 },
      headers: new Headers({ cookie: cookieHeader }),
    });
    console.info(
      `PASS: ${label} was allowed to list users (${result.total} total).`,
    );
    return true;
  } catch (error) {
    console.error(
      `FAIL: ${label} was refused listing users — ${describeError(error)}`,
    );
    return false;
  }
}

async function expectListUsersRefused(
  auth: Auth,
  cookieHeader: string,
  label: string,
): Promise<boolean> {
  try {
    await auth.api.listUsers({
      query: { limit: 1 },
      headers: new Headers({ cookie: cookieHeader }),
    });
    console.error(
      `FAIL: ${label} was allowed to list users, so staff is not denied.`,
    );
    return false;
  } catch (error) {
    if (isForbiddenError(error)) {
      console.info(
        `PASS: ${label} was refused listing users — ${describeError(error)}`,
      );
      return true;
    }
    console.error(
      `FAIL: ${label} was refused, but not with FORBIDDEN — ${describeError(error)}`,
    );
    return false;
  }
}

async function expectCreateUserRefused(
  auth: Auth,
  cookieHeader: string,
  label: string,
): Promise<boolean> {
  try {
    await auth.api.createUser({
      body: {
        email: SECOND_STAFF_EMAIL,
        name: SECOND_STAFF_NAME,
        password: freshPassword(),
      },
      headers: new Headers({ cookie: cookieHeader }),
    });
    console.error(`FAIL: ${label} was allowed to create a user.`);
    return false;
  } catch (error) {
    if (isForbiddenError(error)) {
      console.info(
        `PASS: ${label} was refused creating a user — ${describeError(error)}`,
      );
      return true;
    }
    console.error(
      `FAIL: ${label} was refused, but not with FORBIDDEN — ${describeError(error)}`,
    );
    return false;
  }
}

async function runChecks(auth: Auth): Promise<boolean> {
  const adminPassword = freshPassword();
  const staffPassword = freshPassword();

  await createAdminFixture(auth, adminPassword);
  const staffUser = await createStaffFixtureWithNoRole(auth, staffPassword);
  const isDefaultRoleStaff = staffUser.role === "staff";
  if (isDefaultRoleStaff) {
    console.info(
      'PASS: an admin-created user with no role given defaulted to "staff".',
    );
  } else {
    console.error(
      `FAIL: an admin-created user with no role given defaulted to "${String(staffUser.role)}", not "staff".`,
    );
  }

  const adminCookie = await signInAndGetCookie(
    auth,
    ADMIN_EMAIL,
    adminPassword,
  );
  const staffCookie = await signInAndGetCookie(
    auth,
    STAFF_EMAIL,
    staffPassword,
  );

  const isAdminAllowed = await expectListUsersAllowed(
    auth,
    adminCookie,
    "the admin fixture",
  );
  const isStaffRefusedListing = await expectListUsersRefused(
    auth,
    staffCookie,
    "the staff fixture",
  );
  const isStaffRefusedCreating = await expectCreateUserRefused(
    auth,
    staffCookie,
    "the staff fixture",
  );

  return (
    isDefaultRoleStaff &&
    isAdminAllowed &&
    isStaffRefusedListing &&
    isStaffRefusedCreating
  );
}

async function main(): Promise<void> {
  loadDevEnv();
  const { auth } = await import("@/lib/auth");
  const { db } = await import("@/lib/db");

  try {
    await removeFixtures(db);
    const hasPassed = await runChecks(auth);

    if (hasPassed) {
      console.info(
        "PASS: the role model in src/lib/auth.ts behaves as documented against better-auth@1.7.1.",
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
    `FAIL: verify-admin-role-model stopped: ${describeError(error)}`,
  );
  process.exitCode = 1;
});
