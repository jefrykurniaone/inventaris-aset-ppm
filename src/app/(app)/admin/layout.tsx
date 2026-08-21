import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/require-user";

/**
 * Gates every admin-only route (PRD FR-1.3) in one place: `requireAdmin()`
 * redirects a signed-in non-admin to `/not-authorized` before any nested
 * page renders. This is the route-tree half of the protection; the
 * mutation-level half is `requireAdmin()` called again inside each server
 * action, because an action can be invoked directly without ever passing
 * through this layout.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireAdmin();
  return children;
}
