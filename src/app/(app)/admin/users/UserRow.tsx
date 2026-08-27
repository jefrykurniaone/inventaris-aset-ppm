import { getTranslations } from "next-intl/server";

import { RoleBadge } from "@/components/RoleBadge";
import { SubmitButton } from "@/components/SubmitButton";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format-date";

import { reactivateUserAction } from "./actions";
import { DeactivateUserDialog } from "./DeactivateUserDialog";
import type { AdminUserRowUser } from "./schemas";

type AdminUsersT = Awaited<
  ReturnType<typeof getTranslations<"AdminUsersPage">>
>;

interface UserRowControlProps {
  readonly user: AdminUserRowUser;
  readonly t: AdminUsersT;
}

/**
 * The one control a row offers, which depends on where the account is:
 * deactivated accounts get a one-click reactivate, active ones get the dialog
 * that captures the required reason (issue #86). Reactivation needs no dialog
 * — the reason it clears is already on file, and `reactivateUserAction`
 * copies it into the activity log before Better Auth's `unbanUser` nulls it.
 *
 * A module-level sibling of `UserRow`, not a component defined inside its
 * render (SonarQube `typescript:S6478`), matching `CreateUserForm`'s
 * `FormField`.
 */
function UserRowControl({ user, t }: Readonly<UserRowControlProps>) {
  if (user.banned) {
    return (
      <form action={reactivateUserAction}>
        <input type="hidden" name="userId" value={user.id} />
        <SubmitButton
          variant="outline"
          idleLabel={t("reactivate")}
          pendingLabel={t("reactivatePending")}
        />
      </form>
    );
  }

  return (
    <DeactivateUserDialog
      userId={user.id}
      labels={{
        trigger: t("deactivate"),
        pending: t("deactivatePending"),
        title: t("deactivateConfirmTitle"),
        description: t("deactivateConfirmDescription"),
        reasonLabel: t("reasonLabel"),
        cancel: t("cancel"),
        confirm: t("deactivateConfirm"),
      }}
    />
  );
}

interface UserRowProps {
  readonly user: AdminUserRowUser;
  readonly isSelf: boolean;
  readonly locale: Locale;
  readonly t: AdminUsersT;
}

/**
 * One row of the admin user table: identity, role, status, the reason a
 * deactivated account was deactivated, and — unless this row is the signed-in
 * admin's own account — a deactivate/reactivate control. Split out of
 * `UserTable`/`AdminUsersPage` to keep every function in this feature under
 * the project's 40-line limit.
 *
 * The reason cell is restricted data (issue #86). It is safe here because the
 * whole surface is: `admin/layout.tsx` refuses a non-admin before this page
 * renders, and `AdminUsersPage` calls `requireAdmin()` again itself. No other
 * surface in the application selects `banReason` at all.
 */
export function UserRow({ user, isSelf, locale, t }: Readonly<UserRowProps>) {
  const isDeactivated = Boolean(user.banned);
  const deactivationReason = isDeactivated ? (user.banReason ?? "") : "";
  const createdAt = new Date(user.createdAt);

  return (
    <tr className="border-border border-b">
      <td className="py-2 pr-4">{user.name}</td>
      <td className="py-2 pr-4">{user.email}</td>
      <td className="py-2 pr-4">
        <RoleBadge role={user.role} />
      </td>
      <td className="py-2 pr-4">
        {isDeactivated ? t("statusDeactivated") : t("statusActive")}
      </td>
      <td className="py-2 pr-4 whitespace-nowrap">
        <time dateTime={createdAt.toISOString()}>
          {formatDate(createdAt, locale)}
        </time>
      </td>
      <td className="py-2 pr-4">{deactivationReason}</td>
      <td className="py-2">
        {!isSelf && <UserRowControl user={user} t={t} />}
      </td>
    </tr>
  );
}
