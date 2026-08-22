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
      {/* Never useful on paper — hidden here rather than per-page, so a print
          of any authenticated screen never carries the app chrome (#12's
          "browser chrome, app navigation ... excluded from print"). */}
      <div className="print:hidden">
        <AppHeader user={user} />
      </div>
      <main className="flex-1 p-4 print:p-0">{children}</main>
    </div>
  );
}
