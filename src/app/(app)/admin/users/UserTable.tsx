import { getTranslations } from "next-intl/server";

import type { AdminUserRowUser } from "./schemas";
import { UserRow } from "./UserRow";

type AdminUsersT = Awaited<
  ReturnType<typeof getTranslations<"AdminUsersPage">>
>;

interface UserTableProps {
  readonly users: readonly AdminUserRowUser[];
  readonly currentUserId: string;
  readonly t: AdminUsersT;
}

const COLUMN_KEYS = [
  "columnName",
  "columnEmail",
  "columnRole",
  "columnStatus",
  "columnActions",
] as const;

/** The admin user list itself, split out of `AdminUsersPage` so that
 * function stays inside the project's 40-line limit. */
export function UserTable({
  users,
  currentUserId,
  t,
}: Readonly<UserTableProps>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            {COLUMN_KEYS.map((key) => (
              <th key={key} scope="col" className="py-2 pr-4 font-medium">
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
