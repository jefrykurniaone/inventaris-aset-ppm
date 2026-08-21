import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { RoleBadge } from "@/components/RoleBadge";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ADMIN_ROLE } from "@/lib/roles";
import type { SessionUser } from "@/lib/require-user";

interface AppHeaderProps {
  readonly user: SessionUser;
}

const NAV_LINK_CLASS = "text-sm font-medium hover:underline";

/**
 * The application shell's header (PRD FR-1.5's shell, and FR-10.3's "locale
 * switcher in the application shell"): current user, role badge, primary
 * navigation, locale switcher, theme toggle, and sign-out. Mounted once by
 * `src/app/(app)/layout.tsx`, which is why `LocaleSwitcher` moved out of the
 * root layout — this is the shell it was always meant to live in.
 */
export async function AppHeader({ user }: Readonly<AppHeaderProps>) {
  const t = await getTranslations("AppShell");
  const signOutT = await getTranslations("SignOutButton");
  const isAdmin = user.role === ADMIN_ROLE;

  return (
    <header className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
      <nav aria-label={t("mainNavLabel")} className="flex items-center gap-4">
        <Link href="/" className={NAV_LINK_CLASS}>
          {t("navHome")}
        </Link>
        {isAdmin && (
          <>
            <Link href="/admin/users" className={NAV_LINK_CLASS}>
              {t("navAdminUsers")}
            </Link>
            <Link href="/admin/categories" className={NAV_LINK_CLASS}>
              {t("navAdminCategories")}
            </Link>
            <Link href="/admin/buildings" className={NAV_LINK_CLASS}>
              {t("navAdminBuildings")}
            </Link>
            <Link href="/admin/rooms" className={NAV_LINK_CLASS}>
              {t("navAdminRooms")}
            </Link>
            <Link href="/admin/funding-sources" className={NAV_LINK_CLASS}>
              {t("navAdminFundingSources")}
            </Link>
          </>
        )}
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("signedInAs")}</span>
          <span className="font-medium">{user.email}</span>
          <RoleBadge role={user.role} />
        </div>
        <LocaleSwitcher />
        <ThemeToggle />
        <SignOutButton
          label={signOutT("label")}
          pendingLabel={signOutT("pending")}
        />
      </div>
    </header>
  );
}
