import { z } from "zod";

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

/**
 * The single source of truth for "is this string a supported locale",
 * shared between the server action that receives untrusted input
 * (`src/i18n/set-locale.ts`) and anything on the client that wants the same
 * check ahead of the round-trip. Per the project standard, a server action
 * is an HTTP entry point and validates with a Zod schema built from this
 * same array, rather than trusting the `Locale` type — a compile-time type
 * is erased by the time a request reaches the action.
 */
export const localeSchema = z.enum(locales);

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

/**
 * Resolves an arbitrary cookie value to a supported locale, falling back to
 * the default. A cookie tampered with or left over from a removed locale
 * must never crash message loading — this is defence in depth alongside
 * the schema above, not a substitute for it: a request body is validated
 * at the action, a cookie is merely defaulted here on read.
 */
export function resolveLocale(candidate: string | undefined): Locale {
  const result = localeSchema.safeParse(candidate);
  return result.success ? result.data : defaultLocale;
}

/**
 * BCP 47 tags fed to `Intl` by every formatting helper in `src/lib/`. Kept
 * as its own map — rather than passing `Locale` straight to `Intl` — so
 * that `id` and `en` always resolve to one exact region (`id-ID`, `en-US`)
 * regardless of the host's default region for that language, and so a
 * locale that later needs a different region only changes one line here.
 */
export const LOCALE_TAGS: Readonly<Record<Locale, string>> = {
  id: "id-ID",
  en: "en-US",
};
