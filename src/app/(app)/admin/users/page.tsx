import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { TableFooterControls } from "@/components/TableFooterControls";
import { auth } from "@/lib/auth";
import { ADMIN_USERS_PATH } from "@/lib/paths";
import { requireAdmin } from "@/lib/require-user";
import {
  buildUserListPagerParams,
  buildUserListParamsWithoutPageSize,
  buildUserListQuery,
  parseUserListParams,
  totalUserListPageCount,
} from "@/lib/user-list-query";

import { CreateUserForm } from "./CreateUserForm";
import { UserTable } from "./UserTable";

interface AdminUsersPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Admin-only user management (PRD FR-1.3): list users, create one with a
 * role, deactivate one. `src/app/(app)/admin/layout.tsx` already refuses a
 * non-admin before this page renders; `requireAdmin()` is called again here
 * because this page specifically needs the signed-in admin's own id, to
 * hide the deactivate control on their own row in `UserTable` — a second
 * `getSession` read is a small price for not threading that id down from
 * the layout.
 *
 * The list is sorted, paged and counted by the `admin()` plugin itself
 * (issue #87): `listUsers` takes `sortBy`, `sortDirection`, `limit` and
 * `offset`, and returns `total` for the pager. Nothing here reads the `user`
 * table through Prisma — `src/lib/auth.ts` stays the only Better Auth seam.
 */
export default async function AdminUsersPage({
  searchParams,
}: Readonly<AdminUsersPageProps>) {
  const currentUser = await requireAdmin();
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("AdminUsersPage"),
  ]);
  const params = parseUserListParams(await searchParams);

  const { users, total } = await auth.api.listUsers({
    query: buildUserListQuery(params),
    headers: await headers(),
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <CreateUserForm />
      <UserTable
        users={users}
        params={params}
        currentUserId={currentUser.id}
        locale={locale}
        t={t}
      />
      <TableFooterControls
        action={ADMIN_USERS_PATH}
        pageSizeParams={buildUserListParamsWithoutPageSize(params)}
        pagerParams={buildUserListPagerParams(params)}
        page={params.page}
        pageSize={params.pageSize}
        pageCount={totalUserListPageCount(total, params.pageSize)}
        totalCount={total}
        pageSizeSelectId="admin-users-page-size"
      />
    </div>
  );
}
