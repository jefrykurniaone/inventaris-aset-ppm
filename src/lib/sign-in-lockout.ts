/**
 * The account-lockout policy for `/sign-in/email` (issue #112), as pure
 * functions: no database, no Better Auth, and no clock of its own — every
 * function that cares about time takes `now` as an argument.
 *
 * `src/lib/auth.ts` wires these into the library's request hooks and
 * `src/lib/sign-in-attempts.ts` supplies the rows. Keeping the part with the
 * interesting boundaries here — when a lock starts, and when it lifts — is what
 * makes those boundaries testable without either.
 *
 * ## The policy
 *
 * Five consecutive failed attempts against one email address lock that address
 * for fifteen minutes, measured from the most recent failure. The lock lifts by
 * itself; no administrator has to clear it.
 *
 * **Temporary rather than admin-cleared, deliberately.** A lock only an admin
 * can lift hands an attacker a denial-of-service lever, and this deployment is
 * an unusually good target for it: the administrator's address is a good guess
 * rather than a secret, because `SEED_ADMIN_EMAIL` seeds a predictable first
 * one. Five deliberate wrong passwords would take the most privileged account
 * offline until somebody intervened — using an account that is itself the one
 * locked out. A cooling-off period costs the attacker the same guessing budget
 * while costing a legitimate user fifteen minutes.
 *
 * ## What the numbers buy
 *
 * Better Auth's own throttle already allows three sign-in requests per ten
 * seconds, and issue #111 moved its counter into the database, which is what
 * makes a reliable lockout possible at all — a per-instance counter cannot
 * implement one. That bounds the *rate* of guessing. This bounds the *total*:
 * past the threshold an address accepts at most one attempt per fifteen
 * minutes, so a patient attacker's ceiling drops from 25,920 guesses a day to
 * 96.
 *
 * Five is high enough that a person mistyping a password they know does not
 * trip it, and low enough that the fifteen-minute price starts being paid long
 * before a guessing run gets anywhere.
 */
import { z } from "zod";

/**
 * Consecutive failures that lock an address. The fifth failure is the one that
 * locks: four are still accepted, which is the boundary
 * `sign-in-lockout.test.ts` pins down.
 */
export const SIGN_IN_FAILURE_THRESHOLD = 5;

/** How long a lock lasts, measured from the most recent failed attempt. */
export const SIGN_IN_LOCK_DURATION_MINUTES = 15;

/**
 * How long attempt rows are kept. The table is written from an unauthenticated
 * endpoint with an attacker-chosen `email`, so it needs a ceiling on growth
 * that does not depend on anybody remembering to prune it; the retention delete
 * rides along with each write instead.
 *
 * Thirty days is two orders of magnitude longer than the fifteen-minute window
 * any lock decision looks at, so retention can never resurrect or cancel a
 * lock — it only decides how far back a human reviewing the log can see.
 */
export const SIGN_IN_ATTEMPT_RETENTION_DAYS = 30;

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1_440;

/** The lock duration in milliseconds, for arithmetic against `Date.getTime()`. */
export const SIGN_IN_LOCK_DURATION_MS =
  SIGN_IN_LOCK_DURATION_MINUTES * MILLISECONDS_PER_MINUTE;

/**
 * The HTTP status Better Auth's `/sign-in/email` returns when it rejects
 * credentials — the same 401 for an unknown address, an account with no
 * password, and a wrong password alike (`dist/api/routes/sign-in.mjs` throws
 * `APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD)`
 * on all three paths). `src/app/(auth)/sign-in/SignInForm.tsx` already keys its
 * one localised failure message off the same number.
 */
export const CREDENTIALS_REJECTED_STATUS = 401;

/** Mirrors the `SignInAttemptOutcome` enum in `prisma/models/enums.prisma`, in
 * the same declared order. Exported as a tuple, not only as a type, so the
 * admin sign-in activity trail (issue #125) can build its outcome filter's
 * options from one place rather than a hand-typed second list that could drift
 * from the enum. */
export const SIGN_IN_ATTEMPT_OUTCOMES = [
  "succeeded",
  "failed",
  "blocked",
] as const;

export type SignInAttemptOutcome = (typeof SIGN_IN_ATTEMPT_OUTCOMES)[number];

/** One logged attempt, reduced to the two columns a lock decision reads. */
export interface SignInAttemptRecord {
  readonly outcome: SignInAttemptOutcome;
  readonly createdAt: Date;
}

export interface SignInLockState {
  readonly isLocked: boolean;
  /**
   * When the lock lifts, or `null` when the failure streak has not reached the
   * threshold and so no lock was ever in force. A non-null value with
   * `isLocked: false` is the expired-lock case.
   */
  readonly lockedUntil: Date | null;
}

const NOT_LOCKED: SignInLockState = { isLocked: false, lockedUntil: null };

/**
 * The instant a lock would run from, or `null` when the newest attempts do not
 * contain a long enough run of failures to lock anything.
 *
 * One pass, returning the timestamp rather than a count, because the caller
 * needs both the verdict and the anchor and a count alone would leave it
 * searching the list again for a row it already walked past.
 *
 * A `succeeded` row ends the streak — that is the reset-on-success path.
 * `blocked` rows are skipped instead: neither counted nor treated as a break,
 * so an attacker hammering an already-locked address can neither extend the
 * lock nor clear it. `src/lib/sign-in-attempts.ts` already excludes them in the
 * query; skipping them here as well is what makes this function correct for any
 * input of its declared type rather than only for that one caller's.
 */
function findLockAnchor(attempts: readonly SignInAttemptRecord[]): Date | null {
  let failures = 0;
  let newestFailureAt: Date | null = null;

  for (const attempt of attempts) {
    if (attempt.outcome === "succeeded") {
      return null;
    }
    if (attempt.outcome === "failed") {
      failures += 1;
      newestFailureAt ??= attempt.createdAt;
      if (failures >= SIGN_IN_FAILURE_THRESHOLD) {
        return newestFailureAt;
      }
    }
  }

  return null;
}

/**
 * Whether an address is currently locked, given its recent attempts.
 *
 * `recentAttemptsNewestFirst` must be ordered newest first, and needs to hold
 * only the newest `SIGN_IN_FAILURE_THRESHOLD` non-`blocked` rows — nothing
 * older can change the answer, because a streak shorter than the threshold
 * never locks and a longer one is already decided by its newest member.
 *
 * The lock runs from the *most recent* failure rather than from the fifth one.
 * That is what makes the policy self-healing without becoming a denial-of-
 * service lever: once the streak is at the threshold the address accepts one
 * attempt per fifteen minutes, and each further wrong password buys another
 * fifteen minutes, but a *right* password ends it immediately.
 */
export function evaluateSignInLock(
  recentAttemptsNewestFirst: readonly SignInAttemptRecord[],
  now: Date,
): SignInLockState {
  const lockAnchor = findLockAnchor(recentAttemptsNewestFirst);
  if (lockAnchor === null) {
    return NOT_LOCKED;
  }

  const lockedUntil = new Date(lockAnchor.getTime() + SIGN_IN_LOCK_DURATION_MS);
  return { isLocked: now.getTime() < lockedUntil.getTime(), lockedUntil };
}

/**
 * Which outcome, if any, a finished `/sign-in/email` request should record.
 *
 * `failureStatus` is the HTTP status of the `APIError` the endpoint produced,
 * or `null` when it produced a session instead. `null` as a *return* value
 * means "record nothing".
 *
 * Only a 401 counts as a `failed` attempt, because only a 401 is a rejected
 * credential. The endpoint's other failures are not password guesses and must
 * not move an address towards a lock:
 *
 *   - 400 `INVALID_EMAIL` — a malformed address. Counting it would let a user
 *     lock themselves out of their own account with five typos.
 *   - 403 `BANNED_USER` / `EMAIL_NOT_VERIFIED` — reached only *after* the
 *     password verified, so the credential was right and there is nothing to
 *     throttle.
 *   - 500 — the application's fault, not the caller's.
 */
export function classifySignInOutcome(
  failureStatus: number | null,
): SignInAttemptOutcome | null {
  if (failureStatus === null) {
    return "succeeded";
  }
  if (failureStatus === CREDENTIALS_REJECTED_STATUS) {
    return "failed";
  }
  return null;
}

/**
 * The bucket an attempt counts against.
 *
 * Lower-cased because Better Auth looks the account up with
 * `email.toLowerCase()`, so without this a mixed-case retry would be the same
 * account to the library and a fresh counter here — a bypass consisting of
 * holding down Shift. Trimmed as well, which is stricter than the library
 * rather than looser: a padded address is a lookup miss there, and folding it
 * into the untrimmed bucket here only makes the counter harder to evade.
 */
export function normalizeSignInEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Attempt rows at or before this instant are past retention. */
export function signInAttemptRetentionCutoff(now: Date): Date {
  return new Date(
    now.getTime() -
      SIGN_IN_ATTEMPT_RETENTION_DAYS *
        MINUTES_PER_DAY *
        MILLISECONDS_PER_MINUTE,
  );
}

/**
 * The submitted address, normalised, or `null` when the request body carries
 * none.
 *
 * The hooks in `src/lib/auth.ts` run for every endpoint and see the body as
 * `unknown`, so this validates rather than casts — `CLAUDE.md` asks for Zod at
 * every entry point, and this is one. A body with no usable `email` is not
 * rejected, only ignored: Better Auth's own schema is the authority on whether
 * the request is well-formed, and the lockout has nothing to key on either way.
 */
const signInBodySchema = z.object({ email: z.string().trim().min(1) });

export function readSignInEmail(body: unknown): string | null {
  const parsed = signInBodySchema.safeParse(body);
  return parsed.success ? normalizeSignInEmail(parsed.data.email) : null;
}
