import { db } from "@/lib/db";
import {
  buildSignInActivityListOrderBy,
  buildSignInActivityListPageWindow,
  buildSignInActivityListWhere,
  type SignInActivityListParams,
} from "@/lib/sign-in-activity-list-query";
import type { SignInAttemptOutcome } from "@/lib/sign-in-lockout";

/**
 * The read for `/admin/sign-in-activity` (issue #125). Imports `db` directly
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
