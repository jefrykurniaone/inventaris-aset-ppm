import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { HOME_PATH } from "@/lib/paths";

/**
 * Reached by a signed-in user whose role does not permit an admin-only
 * route — `requireAdmin()` redirects here, never straight past. Nested
 * under `(app)`, so it still requires a session: a signed-out visitor who
 * guesses this path lands on the sign-in page first, via the shell layout.
 */
export default async function NotAuthorizedPage() {
  const t = await getTranslations("NotAuthorizedPage");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground text-sm">{t("message")}</p>
      <Link href={HOME_PATH} className="text-primary text-sm hover:underline">
        {t("backHome")}
      </Link>
    </div>
  );
}
