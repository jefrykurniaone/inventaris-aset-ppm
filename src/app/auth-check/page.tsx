import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Temporary verification surface for the authentication persistence spike
 * (issue #2, ADR 0002). It reads the Better Auth session and the signed-in
 * user's role inside a server component, which is the half of the spike's pass
 * condition that a script cannot demonstrate.
 *
 * The text is deliberately minimal and unlocalised: `next-intl` arrives with
 * the internationalisation ticket, and this page — along with
 * `scripts/verify-auth-persistence.ts` — is deleted by the sign-in interface
 * ticket. Colours come from the theme tokens, which are already gated at WCAG AA
 * in both themes.
 */
export default async function AuthCheckPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Authentication check
      </h1>
      {session ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted-foreground">User</dt>
          <dd>{session.user.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>{session.user.role ?? "none"}</dd>
          <dt className="text-muted-foreground">Session expires</dt>
          <dd>{session.session.expiresAt.toISOString()}</dd>
        </dl>
      ) : (
        <p className="text-sm">No session on this request.</p>
      )}
    </main>
  );
}
