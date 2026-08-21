import { getTranslations } from "next-intl/server";

import { RoleBadge } from "@/components/RoleBadge";
import { SubmitButton } from "@/components/SubmitButton";

import { deactivateUserAction, reactivateUserAction } from "./actions";
import type { AdminUserRowUser } from "./schemas";

type AdminUsersT = Awaited<
  ReturnType<typeof getTranslations<"AdminUsersPage">>
>;

interface UserRowProps {
  readonly user: AdminUserRowUser;
  readonly isSelf: boolean;
  readonly t: AdminUsersT;
}

/**
 * One row of the admin user table: identity, role, status, and — unless
 * this row is the signed-in admin's own account — a deactivate/reactivate
 * control. Split out of `UserTable`/`AdminUsersPage` to keep every function
 * in this feature under the project's 40-line limit.
 */
export function UserRow({ user, isSelf, t }: Readonly<UserRowProps>) {
  const isBanned = Boolean(user.banned);
  const action = isBanned ? reactivateUserAction : deactivateUserAction;
  const idleLabel = isBanned ? t("reactivate") : t("deactivate");
  const pendingLabel = isBanned
    ? t("reactivatePending")
    : t("deactivatePending");

  return (
    <tr className="border-border border-b">
      <td className="py-2 pr-4">{user.name}</td>
      <td className="py-2 pr-4">{user.email}</td>
      <td className="py-2 pr-4">
        <RoleBadge role={user.role} />
      </td>
      <td className="py-2 pr-4">
        {isBanned ? t("statusDeactivated") : t("statusActive")}
      </td>
      <td className="py-2">
        {!isSelf && (
          <form action={action}>
            <input type="hidden" name="userId" value={user.id} />
            <SubmitButton
              variant="outline"
              idleLabel={idleLabel}
              pendingLabel={pendingLabel}
            />
          </form>
        )}
      </td>
    </tr>
  );
}
