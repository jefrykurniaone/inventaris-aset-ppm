import type { db } from "@/lib/db";
import {
  SIGN_IN_LOCK_DURATION_MS,
  evaluateSignInLock,
  type SignInAttemptRecord,
} from "@/lib/sign-in-lockout";

/**
 * The active-locks section of the admin sign-in activity page (issue #126,
 * spec #124): which addresses are locked out of `/sign-in/email` right now,
 * when each lock started and when it lifts.
 *
 * **Lock state is computed, never stored.** There is no lock table and no lock
 * column; the streak of `failed` rows in `SignInAttempt` is the whole counter,
 * exactly as `prisma/models/sign-in-attempt.prisma` describes. So this module
 * cannot read a lock — it has to derive one, and it must derive the *same* one
 * the sign-in path enforces, or the page lies about who is locked out.
 *
 * That is why every judgement here is delegated to `evaluateSignInLock` in
 * `@/lib/sign-in-lockout`, the one function `@/lib/sign-in-attempts.ts` uses on
 * the enforcement path. Nothing in this module re-implements the policy:
 * not the threshold, not reset-on-success, not the treatment of `blocked`
 * rows, and not the expiry boundary.
 *
 * ## Why candidate discovery cannot filter on the streak
 *
 * A lock is active when the *newest* failure is younger than
 * `SIGN_IN_LOCK_DURATION_MS`. The rest of the streak may be arbitrarily older:
 * four failures last week plus one a minute ago is a locked address. So a
 * candidate filter of the shape "five failures inside the window" would be
 * wrong, and would silently hide real locks.
 *
 * The filter this module builds instead is a deliberate **superset**: any
 * address with at least one `failed` row at or after `now - duration`. Every
 * locked address is necessarily in it, because its anchoring failure is inside
 * that window by definition, and the addresses that are in it without being
 * locked are removed by `evaluateSignInLock` — including the exact-boundary
 * case, which `gte` admits and the evaluation then rejects, since the lock
 * lifts the instant it expires. Candidate discovery narrows the work; it never
 * decides anything.
 *
 * Pure throughout: no database import, no `next/*`, and `now` is an argument
 * everywhere, mirroring the no-clock-of-its-own rule `@/lib/sign-in-lockout`
 * sets. The reads that feed it live in the page's own `queries.ts`.
 */

/**
 * Derived from `db` itself, the same trick `@/lib/sign-in-activity-list-query`
 * uses: `import type` is erased at compile time, so this adds no runtime
 * dependency on the generated Prisma client and does not breach the seam
 * `src/lib/db.ts` owns (CLAUDE.md), while still tying these clauses to the
 * schema.
 */
type SignInAttemptFindManyArgs = NonNullable<
  Parameters<typeof db.signInAttempt.findMany>[0]
>;
export type SignInAttemptWhere = NonNullable<
  SignInAttemptFindManyArgs["where"]
>;

/** One candidate address together with the rows a lock decision reads: its
 * newest `SIGN_IN_FAILURE_THRESHOLD` non-`blocked` attempts, newest first —
 * the precondition `evaluateSignInLock` documents. */
export interface SignInLockCandidate {
  readonly email: string;
  readonly recentAttemptsNewestFirst: readonly SignInAttemptRecord[];
}

/** One row of the section: an address that is locked out at `now`. */
export interface ActiveSignInLock {
  readonly email: string;
  /** The failure the lock runs from. Not a second notion of when a lock
   * started — it is `lockedUntil` less the one lock duration, so it is the
   * same instant `evaluateSignInLock` anchored to. */
  readonly lockedAt: Date;
  readonly lockedUntil: Date;
}

/** The oldest failure that could still be anchoring a live lock. */
export function activeSignInLockWindowStart(now: Date): Date {
  return new Date(now.getTime() - SIGN_IN_LOCK_DURATION_MS);
}

/** The superset filter described above: every address with a recent enough
 * failure to *possibly* be locked. `blocked` and `succeeded` rows are not
 * candidates in their own right — neither can anchor a lock — but they are
 * still read back per candidate below, because a `succeeded` row is what ends
 * a streak. */
export function buildActiveSignInLockCandidateWhere(
  now: Date,
): SignInAttemptWhere {
  return {
    outcome: "failed",
    createdAt: { gte: activeSignInLockWindowStart(now) },
  } as SignInAttemptWhere;
}

/** The rows one candidate is judged on. Identical in shape to the enforcement
 * read in `@/lib/sign-in-attempts.ts`: `blocked` excluded, so the caller's
 * `take` of `SIGN_IN_FAILURE_THRESHOLD` is an exact bound rather than an
 * approximate one — a burst of blocked attempts could otherwise push the
 * failures that matter off the end of the page. */
export function buildSignInLockAttemptsWhere(
  email: string,
): SignInAttemptWhere {
  return { email, outcome: { not: "blocked" } } as SignInAttemptWhere;
}

function toActiveSignInLock(
  candidate: SignInLockCandidate,
  now: Date,
): ActiveSignInLock | null {
  const { isLocked, lockedUntil } = evaluateSignInLock(
    candidate.recentAttemptsNewestFirst,
    now,
  );
  // `lockedUntil === null` is the streak-never-reached-the-threshold case;
  // `!isLocked` with a non-null `lockedUntil` is the expired-lock case. Both
  // are ordinary, and neither belongs in the section.
  if (lockedUntil === null || !isLocked) {
    return null;
  }

  return {
    email: candidate.email,
    lockedAt: new Date(lockedUntil.getTime() - SIGN_IN_LOCK_DURATION_MS),
    lockedUntil,
  };
}

/** Soonest to unlock first, so the top of the section is the lock about to
 * lift and an administrator reads the list as a countdown. Ties break on the
 * address, because two locks anchored to the same millisecond otherwise leave
 * the order to whatever the database returned. */
function compareActiveSignInLocks(
  first: ActiveSignInLock,
  second: ActiveSignInLock,
): number {
  const byUnlockTime =
    first.lockedUntil.getTime() - second.lockedUntil.getTime();
  return byUnlockTime === 0
    ? first.email.localeCompare(second.email)
    : byUnlockTime;
}

/**
 * The locks in force at `now`, from the candidates' attempt rows.
 *
 * Candidates that turn out not to be locked are dropped rather than reported
 * as unlocked: this is a list of what is in force, and an address whose lock
 * expired or whose streak a success reset is in no different a position from
 * one that never failed at all.
 */
export function collectActiveSignInLocks(
  candidates: readonly SignInLockCandidate[],
  now: Date,
): readonly ActiveSignInLock[] {
  const locks: ActiveSignInLock[] = [];

  for (const candidate of candidates) {
    const lock = toActiveSignInLock(candidate, now);
    if (lock !== null) {
      locks.push(lock);
    }
  }

  return locks.sort(compareActiveSignInLocks);
}
