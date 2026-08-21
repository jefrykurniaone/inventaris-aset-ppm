import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/require-user";

import { CreateUserForm } from "./CreateUserForm";
import { UserTable } from "./UserTable";

/** Small enough a directorate's user list will never need pagination UI. */
const LIST_USERS_LIMIT = 100;

/**
 * Admin-only user management (PRD FR-1.3): list users, create one with a
 * role, deactivate one. `src/app/(app)/admin/layout.tsx` already refuses a
 * non-admin before this page renders; `requireAdmin()` is called again here
 * because this page specifically needs the signed-in admin's own id, to
 * hide the deactivate control on their own row in `UserTable` — a second
 * `getSession` read is a small price for not threading that id down from
 * the layout.
 */
export default async function AdminUsersPage() {
  const currentUser = await requireAdmin();
  const t = await getTranslations("AdminUsersPage");

  const { users } = await auth.api.listUsers({
    query: {
      limit: LIST_USERS_LIMIT,
      sortBy: "email",
      sortDirection: "asc",
    },
    headers: await headers(),
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <CreateUserForm />
      <UserTable users={users} currentUserId={currentUser.id} t={t} />
    </div>
  );
}
