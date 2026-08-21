/**
 * Verification script for the authentication persistence spike (issue #2,
 * ADR 0002).
 *
 * It exercises exactly the server-side surface a server component uses —
 * `auth.api.signUpEmail`, `auth.api.signInEmail`, `auth.api.getSession` — against
 * the local PostgreSQL database, and reads the signed-in user's `role` back.
 * That is the spike's pass condition, minus the rendering, which
 * `src/app/auth-check/page.tsx` covers.
 *
 * Run it with:
 *
 *     npx tsx scripts/verify-auth-persistence.ts
 *
 * The process exits on its own. A non-zero exit code means the pass condition
 * was not met. Both this script and the page are deleted by the sign-in
 * interface ticket.
 */
import { randomBytes } from "node:crypto";

/** Development environment file. Prisma and Better Auth do not load it. */
const DEV_ENV_FILE = ".env.local";

/** Fixture identity. `.invalid` is reserved by RFC 2606, so it never resolves. */
const SPIKE_EMAIL = "auth-spike@example.invalid";
const SPIKE_NAME = "Auth Persistence Spike";

/** A fresh random password per run, so no credential is ever committed. */
const PASSWORD_BYTES = 24;

const FIRST_COOKIE_ATTRIBUTE = ";";

/**
 * The seams are imported dynamically, so their types are taken from the module
 * rather than from a value in scope. Type positions are erased, so naming the
 * modules here does not load them.
 */
type Auth = (typeof import("@/lib/auth"))["auth"];
type Db = (typeof import("@/lib/db"))["db"];

function loadDevEnv(): void {
  try {
    process.loadEnvFile(DEV_ENV_FILE);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.info(
      `verify-auth-persistence: ${DEV_ENV_FILE} not loaded (${reason}); using the ambient environment.`,
    );
  }
}

/** Turns the `Set-Cookie` headers of a response into one request `Cookie` value. */
function toCookieHeader(responseHeaders: Headers): string {
  return responseHeaders
    .getSetCookie()
    .map((cookie) => cookie.split(FIRST_COOKIE_ATTRIBUTE)[0])
    .join("; ");
}

function reportSession(
  email: string,
  role: string | null | undefined,
  expiresAt: Date,
  cookieHeader: string,
): void {
  console.info(`session user  : ${email}`);
  console.info(`session role  : ${role ?? "(null)"}`);
  console.info(`session expiry: ${expiresAt.toISOString()}`);
  console.info(`session cookie: ${cookieHeader}`);
  console.info(
    "PASS: sign-up, sign-in, session read and role read all succeeded against local PostgreSQL.",
  );
}

/** Recreates the fixture user from scratch and returns its fresh password. */
async function createFixtureUser(auth: Auth, db: Db): Promise<string> {
  const removed = await db.user.deleteMany({ where: { email: SPIKE_EMAIL } });
  console.info(`cleared ${removed.count} earlier fixture user row(s).`);

  const password = randomBytes(PASSWORD_BYTES).toString("base64url");
  const signedUp = await auth.api.signUpEmail({
    body: { name: SPIKE_NAME, email: SPIKE_EMAIL, password },
  });
  console.info(`signed up     : ${signedUp.user.id}`);

  return password;
}

/** Signs in, then reads the session and the role back through the same cookie. */
async function readSessionAfterSignIn(
  auth: Auth,
  password: string,
): Promise<void> {
  const { headers } = await auth.api.signInEmail({
    returnHeaders: true,
    body: { email: SPIKE_EMAIL, password },
  });
  const cookieHeader = toCookieHeader(headers);

  const session = await auth.api.getSession({
    headers: new Headers({ cookie: cookieHeader }),
  });

  if (!session) {
    console.error(
      "FAIL: getSession returned no session for the cookie a successful sign-in issued.",
    );
    process.exitCode = 1;
    return;
  }

  reportSession(
    session.user.email,
    session.user.role,
    session.session.expiresAt,
    cookieHeader,
  );
}

async function main(): Promise<void> {
  // The seams read their environment when they are first imported, so the
  // environment file has to be in place before either import is evaluated.
  loadDevEnv();
  const { auth } = await import("@/lib/auth");
  const { db } = await import("@/lib/db");

  try {
    const password = await createFixtureUser(auth, db);
    await readSessionAfterSignIn(auth, password);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: verify-auth-persistence stopped: ${reason}`);
  process.exitCode = 1;
});
