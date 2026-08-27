/**
 * Verification script for the account lockout configured in `src/lib/auth.ts`
 * (issue #112). Four properties of the lockout can only be shown against the
 * real library, the real router, and the real database — never read off the
 * config or a unit test:
 *
 *   1. Five consecutive failed attempts against one address stop being
 *      accepted, and the sixth is refused by `hooks.before` rather than by the
 *      endpoint. The `sign_in_attempt` log is the only thing that can tell
 *      those apart, which is the point of criterion 3.
 *   2. A locked address stays locked even for the *right* password, which is
 *      what makes the lock a bound on the total number of guesses.
 *   3. The refusal is **byte-identical** to a genuine wrong password: same
 *      status, same status text, same response body. A blocked attempt leaves
 *      the endpoint through `better-call`'s router error path and a rejected
 *      credential leaves through `dispatchAuthEndpoint`, so the two responses
 *      are built by different code and only a comparison proves they agree.
 *   4. A successful sign-in clears the streak, so four failures plus a success
 *      plus four failures locks nothing.
 *
 * Run it against a local database with:
 *
 *     npx tsx scripts/verify-sign-in-lockout.ts
 *
 * A non-zero exit code means the lockout does not behave as `src/lib/auth.ts`
 * and `src/lib/sign-in-lockout.ts` document. The script creates its own
 * fixture, removes it and its attempt rows before and after the run, and is
 * safe to run repeatedly. It never sleeps: expiry is unit-tested against an
 * injected clock, and the reset path is proven with a real success instead.
 */
import { randomBytes } from "node:crypto";

import { describeError } from "@/lib/log-error";
import {
  SIGN_IN_FAILURE_THRESHOLD,
  normalizeSignInEmail,
} from "@/lib/sign-in-lockout";

/** Development environment file. Better Auth and Prisma do not load it. */
const DEV_ENV_FILE = ".env.local";

/** `.invalid` is reserved by RFC 2606, so the address never resolves. */
const FIXTURE_EMAIL = "lockout-fixture@example.invalid";
const FIXTURE_NAME = "Sign-In Lockout Fixture";

const PASSWORD_BYTES = 24;
const WRONG_PASSWORD = "definitely-not-the-fixture-password";
const SIGN_IN_URL_PATH = "/api/auth/sign-in/email";
const DEFAULT_BASE_URL = "http://localhost:3000";
const EXPECTED_STATUS = 401;

type Auth = (typeof import("@/lib/auth"))["auth"];
type Db = (typeof import("@/lib/db"))["db"];

interface SignInResult {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;
}

function loadDevEnv(): void {
  try {
    process.loadEnvFile(DEV_ENV_FILE);
  } catch (error) {
    console.info(
      `verify-sign-in-lockout: ${DEV_ENV_FILE} not loaded (${describeError(error)}); using the ambient environment.`,
    );
  }
}

function freshPassword(): string {
  return randomBytes(PASSWORD_BYTES).toString("base64url");
}

/**
 * Posts one sign-in through `auth.handler`, the same entry point the Next.js
 * route uses, so the response goes through the router rather than through a
 * direct `auth.api` call. `Origin` is set because the origin check rejects a
 * cross-site request before any of this is reached.
 */
async function attemptSignIn(
  auth: Auth,
  password: string,
): Promise<SignInResult> {
  const baseUrl = process.env.BETTER_AUTH_URL ?? DEFAULT_BASE_URL;
  const origin = new URL(baseUrl).origin;
  const response = await auth.handler(
    new Request(`${origin}${SIGN_IN_URL_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email: FIXTURE_EMAIL, password }),
    }),
  );
  return {
    status: response.status,
    statusText: response.statusText,
    body: await response.text(),
  };
}

/** The logged outcomes for the fixture address, oldest first. */
async function readOutcomes(db: Db): Promise<readonly string[]> {
  const rows = await db.signInAttempt.findMany({
    where: { email: normalizeSignInEmail(FIXTURE_EMAIL) },
    orderBy: { createdAt: "asc" },
    select: { outcome: true },
  });
  return rows.map((row) => String(row.outcome));
}

function report(hasPassed: boolean, description: string): boolean {
  console.info(`${hasPassed ? "PASS" : "FAIL"}: ${description}`);
  return hasPassed;
}

async function removeFixtures(db: Db): Promise<void> {
  const email = normalizeSignInEmail(FIXTURE_EMAIL);
  const users = await db.user.deleteMany({ where: { email } });
  const attempts = await db.signInAttempt.deleteMany({ where: { email } });
  console.info(
    `cleared ${users.count} fixture user row(s) and ${attempts.count} attempt row(s).`,
  );
}

/**
 * Four failures, a success, four more failures. Nothing may be blocked: the
 * success in the middle has to have reset the counter, or the eighth failure
 * would be the fifth of an unbroken streak.
 */
async function checkResetOnSuccess(
  auth: Auth,
  db: Db,
  password: string,
): Promise<boolean> {
  const belowThreshold = SIGN_IN_FAILURE_THRESHOLD - 1;
  for (let attempt = 0; attempt < belowThreshold; attempt += 1) {
    await attemptSignIn(auth, WRONG_PASSWORD);
  }

  const success = await attemptSignIn(auth, password);
  const isSignedIn = report(
    success.status === 200,
    `the correct password was accepted after ${belowThreshold} failures (status ${success.status}).`,
  );

  for (let attempt = 0; attempt < belowThreshold; attempt += 1) {
    await attemptSignIn(auth, WRONG_PASSWORD);
  }

  const outcomes = await readOutcomes(db);
  const isStreakReset = report(
    !outcomes.includes("blocked"),
    `a success reset the streak, so ${belowThreshold} more failures blocked nothing (log: ${outcomes.join(", ")}).`,
  );
  return isSignedIn && isStreakReset;
}

/**
 * One more failure takes the streak to the threshold; the next attempt has to
 * be refused by the hook. `blocked` in the log is the only way to tell that
 * refusal from the endpoint's own, which is criterion 3 holding.
 */
async function checkThresholdLocks(
  auth: Auth,
  db: Db,
): Promise<{ readonly hasPassed: boolean; readonly rejected: SignInResult }> {
  const rejected = await attemptSignIn(auth, WRONG_PASSWORD);
  const beforeLock = await readOutcomes(db);
  const isFifthAccepted = report(
    !beforeLock.includes("blocked"),
    `attempt ${SIGN_IN_FAILURE_THRESHOLD} of the streak still reached the endpoint (log: ${beforeLock.join(", ")}).`,
  );

  const blocked = await attemptSignIn(auth, WRONG_PASSWORD);
  const isLocked = report(
    (await readOutcomes(db)).includes("blocked"),
    `attempt ${SIGN_IN_FAILURE_THRESHOLD + 1} was refused by the lockout hook.`,
  );
  const isSameStatus = report(
    blocked.status === EXPECTED_STATUS && rejected.status === EXPECTED_STATUS,
    `both a rejected credential and a locked address answer ${EXPECTED_STATUS}.`,
  );

  return {
    hasPassed: isFifthAccepted && isLocked && isSameStatus,
    rejected,
  };
}

/** The lock must hold against the right password, or it bounds nothing. */
async function checkLockHoldsAgainstTheRightPassword(
  auth: Auth,
  password: string,
  rejected: SignInResult,
): Promise<boolean> {
  const blocked = await attemptSignIn(auth, password);
  const isRefused = report(
    blocked.status === EXPECTED_STATUS,
    `a locked address refuses the correct password too (status ${blocked.status}).`,
  );
  const isIndistinguishable = report(
    blocked.status === rejected.status &&
      blocked.statusText === rejected.statusText &&
      blocked.body === rejected.body,
    `the locked response is byte-identical to a wrong password (${blocked.status} ${blocked.statusText} ${blocked.body}).`,
  );
  return isRefused && isIndistinguishable;
}

/**
 * The two strings `src/lib/auth.ts` restates are copies of
 * `@better-auth/core`'s own, which this project may not import. `$ERROR_CODES`
 * is the public surface that still carries them, so a library-side rename
 * fails here rather than quietly reopening the enumeration oracle.
 */
function checkErrorCodeStillMatches(
  auth: Auth,
  rejected: SignInResult,
): boolean {
  const { code, message } = auth.$ERROR_CODES.INVALID_EMAIL_OR_PASSWORD;
  return report(
    rejected.body === JSON.stringify({ message, code }),
    `the restated rejection body still matches the library's (${code}).`,
  );
}

async function runChecks(auth: Auth, db: Db): Promise<boolean> {
  const password = freshPassword();
  const { user } = await auth.api.createUser({
    body: { email: FIXTURE_EMAIL, name: FIXTURE_NAME, password },
  });
  console.info(`created fixture: ${user.id} (role ${String(user.role)})`);

  const isResetProven = await checkResetOnSuccess(auth, db, password);
  const { hasPassed: isLockProven, rejected } = await checkThresholdLocks(
    auth,
    db,
  );
  const isHoldProven = await checkLockHoldsAgainstTheRightPassword(
    auth,
    password,
    rejected,
  );
  const isBodyProven = checkErrorCodeStillMatches(auth, rejected);

  return isResetProven && isLockProven && isHoldProven && isBodyProven;
}

async function main(): Promise<void> {
  loadDevEnv();
  const { auth } = await import("@/lib/auth");
  const { db } = await import("@/lib/db");

  try {
    await removeFixtures(db);
    if (await runChecks(auth, db)) {
      console.info(
        "PASS: the sign-in lockout in src/lib/auth.ts behaves as documented against better-auth@1.7.1.",
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
    `FAIL: verify-sign-in-lockout stopped: ${describeError(error)}`,
  );
  process.exitCode = 1;
});
