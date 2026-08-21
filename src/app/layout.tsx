import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import "./globals.css";

import { LocaleSwitcher } from "@/components/LocaleSwitcher";

/**
 * Root layout. `lang` and the metadata below now come from the active
 * locale instead of being hardcoded, and `NextIntlClientProvider` makes the
 * request's locale and messages available to Client Components — the
 * locale switcher itself, and anything later tickets add. The switcher is
 * mounted here so every page gets it for free, including the ones that
 * arrive with their own tickets.
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

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <header className="border-border flex justify-end border-b px-4 py-2">
            <LocaleSwitcher />
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
