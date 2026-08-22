import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/LocaleSwitcher";

/**
 * The frame every state of the public scan page renders inside — the asset,
 * the withdrawn record, and the not-found page alike.
 *
 * It is *not* the application shell: `AppHeader` carries a sign-out control, a
 * navigation bar and the user's name, none of which mean anything to someone
 * who just pointed a phone at a sticker. What this carries is the locale
 * switcher (FR-10.3) and the owning unit's name, so a visitor can tell whose
 * asset register they are looking at.
 *
 * `<main>` lives here because the root layout deliberately renders nothing
 * between `<body>` and its children; `(app)/layout.tsx` supplies its own, and
 * this route is not under it.
 */
export async function ScanPageShell({
  children,
}: Readonly<{ children: ReactNode }>) {
  const ts = await getTranslations("ScanPage");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <p className="text-sm font-semibold">{ts("organisation")}</p>
        <LocaleSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4">
        {children}
      </main>
    </div>
  );
}
