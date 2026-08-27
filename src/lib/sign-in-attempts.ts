/**
 * The durable half of the sign-in lockout (issue #112): reading an address's
 * recent attempts and appending one. The policy those rows feed lives in
 * `src/lib/sign-in-lockout.ts`, which knows nothing about a database; the
 * Better Auth wiring lives in `src/lib/auth.ts`, which is the only module
 * allowed to import the library.
 *
 * Both exported functions are **best effort and never throw.** They sit on the
 * sign-in path, and a lockout that could turn a database hiccup into a failed
 * or five-hundred'd sign-in would be a worse availability bug than the one it
 * closes. So:
 *
 *   - a failed read fails *open*, returning "not locked". This is not a bypass
 *     an attacker can reach for: making the read fail means making the database
 *     unreachable, and Better Auth's own credential lookup goes to the same
 *     database one step later, so the sign-in fails anyway.
 *   - a failed write is logged and swallowed. Losing one log row is worth less
 *     than refusing a sign-in that had already been decided.
 *
 * Errors are logged with location, input, and message per `CLAUDE.md`, but the
 * input logged is the outcome and never the address. The durable row holds the
 * address because reviewing the log needs it; a line in stdout, which ends up
 * in whatever aggregator the platform ships to, does not.
 */
import { db } from "@/lib/db";
import { createActionErrorLogger } from "@/lib/log-error";
import {
  SIGN_IN_FAILURE_THRESHOLD,
  evaluateSignInLock,
  normalizeSignInEmail,
  signInAttemptRetentionCutoff,
  type SignInAttemptOutcome,
  type SignInLockState,
} from "@/lib/sign-in-lockout";

const logSignInAttemptError = createActionErrorLogger(
  "src/lib/sign-in-attempts",
);

const NOT_LOCKED: SignInLockState = { isLocked: false, lockedUntil: null };

/**
 * Whether the submitted address is currently locked out.
 *
 * The query asks for exactly what the policy needs and no more: the newest
 * `SIGN_IN_FAILURE_THRESHOLD` rows for this address, `blocked` ones excluded so
 * that the `take` is an exact bound rather than an approximate one — a burst of
 * blocked attempts could otherwise push the failures that matter off the end of
 * the page.
 */
export async function readSignInLockState(
  email: string,
  now: Date,
): Promise<SignInLockState> {
  try {
    const attempts = await db.signInAttempt.findMany({
      where: {
        email: normalizeSignInEmail(email),
        outcome: { not: "blocked" },
      },
      orderBy: { createdAt: "desc" },
      take: SIGN_IN_FAILURE_THRESHOLD,
      select: { outcome: true, createdAt: true },
    });
    return evaluateSignInLock(attempts, now);
  } catch (error) {
    logSignInAttemptError("readSignInLockState", { failedOpen: true }, error);
    return NOT_LOCKED;
  }
}

/**
 * Appends one attempt to the log, and drops that address's rows that are past
 * retention while it is there.
 *
 * Both statements go in one `$transaction` array, so housekeeping costs a
 * statement rather than a second round trip. Pruning per address rather than
 * table-wide keeps the delete on the same
 * `@@index([email, createdAt])` the read uses, and keeps a sign-in from ever
 * paying for a scan of somebody else's rows.
 */
export async function recordSignInAttempt(
  email: string,
  outcome: SignInAttemptOutcome,
  now: Date,
): Promise<void> {
  const normalisedEmail = normalizeSignInEmail(email);
  try {
    await db.$transaction([
      db.signInAttempt.create({ data: { email: normalisedEmail, outcome } }),
      db.signInAttempt.deleteMany({
        where: {
          email: normalisedEmail,
          createdAt: { lt: signInAttemptRetentionCutoff(now) },
        },
      }),
    ]);
  } catch (error) {
    logSignInAttemptError("recordSignInAttempt", { outcome }, error);
  }
}
