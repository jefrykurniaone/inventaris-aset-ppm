import { getTranslations } from "next-intl/server";

import { locales } from "@/i18n/config";

import { LocaleSwitcherSelect } from "./LocaleSwitcherSelect";

/**
 * Server Component wrapper: resolves the switcher's own labels — and the
 * option labels — on the server, so translating them costs no client
 * bundle. Only `LocaleSwitcherSelect` needs to run in the browser.
 *
 * Usable as-is in the authenticated shell and on the public scan page —
 * both arrive in later tickets — because it takes no props tying it to
 * either.
 */
export async function LocaleSwitcher() {
  const t = await getTranslations("LocaleSwitcher");
  const options = locales.map((value) => ({ value, label: t(value) }));

  return <LocaleSwitcherSelect label={t("label")} options={options} />;
}
