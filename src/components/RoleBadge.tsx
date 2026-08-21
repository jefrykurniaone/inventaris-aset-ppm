import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { ADMIN_ROLE } from "@/lib/roles";

interface RoleBadgeProps {
  readonly role: string | null | undefined;
}

/**
 * Renders a user's role as a badge, in the application shell's header and
 * in the admin user table. A Server Component, like `LocaleSwitcher`'s
 * server half, so the translated labels cost no client bundle.
 */
export async function RoleBadge({ role }: Readonly<RoleBadgeProps>) {
  const t = await getTranslations("Role");
  const isAdmin = role === ADMIN_ROLE;

  return (
    <Badge variant={isAdmin ? "default" : "secondary"}>
      {isAdmin ? t("admin") : t("staff")}
    </Badge>
  );
}
