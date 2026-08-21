import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { resolveTheme, THEME_COOKIE_NAME } from "@/lib/theme";

import { ThemeToggleButton } from "./ThemeToggleButton";

/**
 * Server Component wrapper: resolves the toggle's translated labels and the
 * theme currently persisted in the cookie (the same one the root layout
 * reads to set the `dark` class server-side), so only `ThemeToggleButton`
 * needs to run in the browser. Mounted in the application shell only — see
 * `src/app/(app)/layout.tsx` — because that is the shell this ticket builds;
 * the theme class itself still applies everywhere via the root layout.
 */
export async function ThemeToggle() {
  const t = await getTranslations("ThemeToggle");
  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE_NAME)?.value);

  return (
    <ThemeToggleButton
      initialTheme={theme}
      labelToDark={t("labelToDark")}
      labelToLight={t("labelToLight")}
    />
  );
}
