import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

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
