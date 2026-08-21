import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE_NAME, resolveLocale } from "./config";

/**
 * `next-intl`'s per-request configuration. Read by `next-intl/plugin` (see
 * `next.config.ts`) for every server render. Locale comes from the cookie
 * the locale switcher writes (`src/i18n/set-locale.ts`); there is no
 * `Accept-Language` negotiation, because FR-10.1 fixes Indonesian as the
 * default regardless of the visitor's browser locale.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return { locale, messages };
});
