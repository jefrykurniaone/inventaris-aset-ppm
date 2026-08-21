/**
 * Locale configuration shared by the request config, the locale-switching
 * server action, and the message-catalogue parity test. There is no
 * `[locale]` route segment and no `next-intl` middleware: the public scan
 * page URL is fixed by FR-5.1 (`https://<host>/a/<qrToken>`) and must not
 * gain a locale prefix. Locale is negotiated from a cookie only.
 */

/** Indonesian is the default per PRD FR-10.1: the audience reads Indonesian. */
export const locales = ["id", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "id";

/** Cookie the request config reads and the locale switcher writes. */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;

/** One year, so a returning visitor keeps their choice without re-selecting it. */
export const LOCALE_COOKIE_MAX_AGE_SECONDS =
  SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * DAYS_PER_YEAR;

function isLocale(candidate: string | undefined): candidate is Locale {
  return (locales as readonly string[]).includes(candidate ?? "");
}

/**
 * Resolves an arbitrary cookie value to a supported locale, falling back to
 * the default. A cookie tampered with or left over from a removed locale
 * must never crash message loading.
 */
export function resolveLocale(candidate: string | undefined): Locale {
  return isLocale(candidate) ? candidate : defaultLocale;
}
