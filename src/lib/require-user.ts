import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { NOT_AUTHORIZED_PATH, SIGN_IN_PATH } from "@/lib/paths";
import { ADMIN_ROLE } from "@/lib/roles";

export { NOT_AUTHORIZED_PATH, SIGN_IN_PATH };

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

/** The `user` shape Better Auth returns once the `admin()` plugin is active. */
export type SessionUser = NonNullable<Session>["user"];

/**
 * Reads the current request's session, or `null` when none exists. This is
 * the one place `auth.api.getSession` is called for authorisation purposes,
 * so `requireUser` and `requireAdmin` below — and anything that only wants to
 * know who is signed in without enforcing it, such as the sign-in page's
 * already-authenticated check — all read the session the same way.
 *
 * Wrapped in React's `cache()` so the lookup runs **once per request** rather
 * than once per caller (issue #83). The `(app)` route-group layout and the
 * page nested inside it both call `requireUser()` on every navigation, and
 * each call used to be its own `auth.api.getSession` — a session row read
 * across the Pacific, twice. `cache()` memoizes on the argument list, and
 * this function takes none, so every caller in one request shares one entry.
 *
 * The memoization is a pure saving, never a behaviour change: outside a React
 * request scope — a Vitest unit test, a `tsx` script — `react`'s non-server
 * build of `cache()` is a straight pass-through to the wrapped function, so
 * the "no session means no user" contract holds identically either way.
 *
 * A banned user is treated as having no session at all (issue #114). Session
 * invalidation on ban already works — `auth.api.banUser` deletes every
 * session row, and the admin plugin refuses a new sign-in for a banned user —
 * but that only holds while `session.cookieCache` stays off in
 * `src/lib/auth.ts`, since the cached fast path never re-reads `banned`.
 * Checking it here, rather than depending on that library-config detail,
 * costs nothing extra: `banned` is already on the `user` object the session
 * call returns.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.banned) {
    return null;
  }
  return session.user;
});

/**
 * The server-side authorisation boundary every server action and route
 * handler calls (PRD FR-1.5). `redirect()` from `next/navigation` throws a
 * `NEXT_REDIRECT` signal that Next.js turns into a real HTTP redirect in a
 * Server Component, a Server Action, or a Route Handler alike, so this one
 * function is correct in all three — there is no silent pass: a missing
 * session always ends the request here, never returns to the caller.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(SIGN_IN_PATH);
  }
  return user;
}

/**
 * Layers the `admin` role requirement (PRD FR-1.3) on top of `requireUser`.
 * A signed-out caller still lands on the sign-in page, not the "not
 * authorised" page — that page is for someone who is genuinely signed in but
 * lacks the role, which is a distinct condition from having no session.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== ADMIN_ROLE) {
    redirect(NOT_AUTHORIZED_PATH);
  }
  return user;
}
