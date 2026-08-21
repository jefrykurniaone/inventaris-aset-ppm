import type { ReactNode } from "react";

import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/require-user";

/**
 * The authenticated application shell. Every route nested under this route
 * group requires a session (PRD FR-1.5): `requireUser()` redirects to
 * `/sign-in` before anything under it renders. The public scan page
 * (`/a/[token]`, arriving in a later ticket), the sign-in page, and the auth
 * API route handler all live outside this group specifically so they stay
 * reachable without a session — nesting a page under `(app)` is what
 * "protected" means in this codebase.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader user={user} />
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
