import { getTranslations } from "next-intl/server";

import type { TableColumnSpec } from "@/components/table-columns";
import { TableHeaderCells } from "@/components/TableHeaderCells";
import type { Locale } from "@/i18n/config";
import { ADMIN_USERS_PATH } from "@/lib/paths";
import type { SortDirection } from "@/lib/table-sort";
import {
  withUserListSort,
  type UserListParams,
  type UserListSortKey,
} from "@/lib/user-list-query";

import type { AdminUserRowUser } from "./schemas";
import { UserRow } from "./UserRow";

type AdminUsersT = Awaited<
  ReturnType<typeof getTranslations<"AdminUsersPage">>
>;

type AdminUsersMessageKey = Parameters<AdminUsersT>[0];

interface UserTableProps {
  readonly users: readonly AdminUserRowUser[];
  readonly params: UserListParams;
  readonly currentUserId: string;
  readonly locale: Locale;
  readonly t: AdminUsersT;
}

interface UserColumn {
  readonly id: string;
  readonly labelKey: AdminUsersMessageKey;
  readonly sortKey?: UserListSortKey;
  readonly initialDirection?: SortDirection;
}

/** The curated sortable set (issue #87): name, email and creation time. Role
 * and status hold two or three distinct values apiece, which sorts nothing
 * useful; the deactivation reason is prose; the actions column is a control. */
const USER_COLUMNS: readonly UserColumn[] = [
  { id: "name", labelKey: "columnName", sortKey: "name" },
  { id: "email", labelKey: "columnEmail", sortKey: "email" },
  { id: "role", labelKey: "columnRole" },
  { id: "status", labelKey: "columnStatus" },
  {
    id: "createdAt",
    labelKey: "columnCreatedAt",
    sortKey: "createdAt",
    initialDirection: "desc",
  },
  { id: "reason", labelKey: "columnReason" },
  { id: "actions", labelKey: "columnActions" },
];

function toColumnSpecs(
  t: AdminUsersT,
): readonly TableColumnSpec<UserListSortKey>[] {
  return USER_COLUMNS.map((column) => ({
    id: column.id,
    label: t(column.labelKey),
    sortKey: column.sortKey,
    initialDirection: column.initialDirection,
  }));
}

/** The admin user list itself, split out of `AdminUsersPage` so that
 * function stays inside the project's 40-line limit. */
export function UserTable({
  users,
  params,
  currentUserId,
  locale,
  t,
}: Readonly<UserTableProps>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            <TableHeaderCells
              action={ADMIN_USERS_PATH}
              columns={toColumnSpecs(t)}
              sortKey={params.sort}
              direction={params.dir}
              paramsFor={(sortKey, direction) =>
                withUserListSort(params, sortKey, direction)
              }
            />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
              locale={locale}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
