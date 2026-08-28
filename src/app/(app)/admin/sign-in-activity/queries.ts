import { db } from "@/lib/db";
import {
  buildActiveSignInLockCandidateWhere,
  buildSignInLockAttemptsWhere,
  collectActiveSignInLocks,
  type ActiveSignInLock,
  type SignInLockCandidate,
} from "@/lib/sign-in-active-locks";
import {
  buildSignInActivityListOrderBy,
  buildSignInActivityListPageWindow,
  buildSignInActivityListWhere,
  type SignInActivityListParams,
} from "@/lib/sign-in-activity-list-query";
import {
  SIGN_IN_FAILURE_THRESHOLD,
  type SignInAttemptOutcome,
} from "@/lib/sign-in-lockout";

/**
 * The reads for `/admin/sign-in-activity` (issues #125 and #126). Imports `db`
 * directly
 * from the shared seam rather than going through `@/lib/sign-in-attempts.ts`:
 * that module's reads are best-effort and fail open because they sit on the
 * unauthenticated sign-in path, and that is the wrong failure mode for an
 * admin audit page — a broken query here should surface as a broken page, not
 * as a silently empty trail. This is also the one place outside
 * `@/lib/sign-in-attempts.ts` that reads `signInAttempt`, so the restriction
 * that table's own schema comment states — "no public query reads this
 * table" — still holds; this route is admin-only (`AdminLayout` plus
 * `requireAdmin()` on the page itself).
 */

export interface SignInActivityListRow {
  readonly id: string;
  readonly email: string;
  readonly outcome: SignInAttemptOutcome;
  readonly createdAt: Date;
}

export interface SignInActivityListPageResult {
  readonly rows: readonly SignInActivityListRow[];
  readonly totalCount: number;
}

const SIGN_IN_ACTIVITY_LIST_SELECT = {
  id: true,
  email: true,
  outcome: true,
  createdAt: true,
} as const;

/** One page of the trail, filtered, sorted and paginated at the database —
 * the `where`, `orderBy` and page window all come from the pure translation
 * in `@/lib/sign-in-activity-list-query`, so there is a query to check rather
 * than a rendered table to eyeball. */
export async function listSignInActivityPage(
  params: SignInActivityListParams,
): Promise<SignInActivityListPageResult> {
  const where = buildSignInActivityListWhere(params);
  const { skip, take } = buildSignInActivityListPageWindow(
    params.page,
    params.pageSize,
  );

  const [rows, totalCount] = await Promise.all([
    db.signInAttempt.findMany({
      where,
      orderBy: buildSignInActivityListOrderBy(params.sort, params.dir),
      skip,
      take,
      select: SIGN_IN_ACTIVITY_LIST_SELECT,
    }),
    db.signInAttempt.count({ where }),
  ]);

  return { rows, totalCount };
}

/** The two columns a lock decision reads — the same projection
 * `@/lib/sign-in-attempts.ts` selects on the enforcement path, so both sides
 * hand `evaluateSignInLock` the identical shape. */
const SIGN_IN_LOCK_ATTEMPT_SELECT = {
  outcome: true,
  createdAt: true,
} as const;

/** One candidate's newest non-`blocked` attempts, newest first, capped at the
 * threshold — the precondition `evaluateSignInLock` documents, and a copy of
 * the enforcement query rather than a variation on it. */
async function readSignInLockCandidate(
  email: string,
): Promise<SignInLockCandidate> {
  const recentAttemptsNewestFirst = await db.signInAttempt.findMany({
    where: buildSignInLockAttemptsWhere(email),
    orderBy: { createdAt: "desc" },
    take: SIGN_IN_FAILURE_THRESHOLD,
    select: SIGN_IN_LOCK_ATTEMPT_SELECT,
  });

  return { email, recentAttemptsNewestFirst };
}

/**
 * The addresses locked out of sign-in at `now` (issue #126).
 *
 * Two steps, and the split is the point. The `groupBy` narrows the table to
 * the addresses that could possibly be locked — one recent failure is enough
 * to qualify, deliberately a superset, see `@/lib/sign-in-active-locks` — and
 * decides nothing else. Each candidate is then read and judged exactly as the
 * sign-in path judges it, so no lock semantics live in SQL.
 *
 * Per-candidate reads rather than one wide read: the streak that anchors a
 * lock can stretch arbitrarily far back, so there is no time bound that would
 * make a single query both correct and bounded, and Prisma has no per-group
 * limit. Each of these hits the `@@index([email, createdAt])` for at most
 * `SIGN_IN_FAILURE_THRESHOLD` rows, and the candidate set is only the
 * addresses that failed within the last lock duration.
 */
export async function listActiveSignInLocks(
  now: Date,
): Promise<readonly ActiveSignInLock[]> {
  const candidateEmails = await db.signInAttempt.groupBy({
    by: ["email"],
    where: buildActiveSignInLockCandidateWhere(now),
  });

  const candidates = await Promise.all(
    candidateEmails.map((group) => readSignInLockCandidate(group.email)),
  );

  return collectActiveSignInLocks(candidates, now);
}
