import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import "./globals.css";

import { RouteProgressBar } from "@/components/RouteProgressBar";
import { resolveTheme, THEME_COOKIE_NAME } from "@/lib/theme";

/**
 * Root layout. `lang` and the metadata below come from the active locale;
 * `NextIntlClientProvider` makes the request's locale and messages
 * available to Client Components. The locale switcher used to be mounted
 * here directly, because no shell existed yet — it now lives in the
 * application shell (`src/app/(app)/layout.tsx`, via `AppHeader`), which is
 * what it was always for, so this layout renders nothing between `<body>`
 * and its children besides the providers every page needs.
 *
 * The theme cookie is read here, once, for every route including the public
 * ones outside `(app)`: applying the `dark` class server-side, before the
 * first paint, is what avoids a flash of the wrong theme on load. The
 * theme *toggle* control itself is shell-only (`src/components/ThemeToggle.tsx`);
 * the persisted choice it writes applies everywhere through this class.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("RootLayout");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const locale = await getLocale();
  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const t = await getTranslations("RouteProgressBar");

  return (
    <html lang={locale} className={theme === "dark" ? "dark" : undefined}>
      <body>
        {/* Suspense is required by `useSearchParams` inside
            `RouteProgressBar` (Next.js's `missing-suspense-with-csr-bailout`
            build error otherwise) — a `null` fallback is fine, since the bar
            has nothing to show before hydration anyway. */}
        <Suspense fallback={null}>
          <RouteProgressBar label={t("navigating")} />
        </Suspense>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
