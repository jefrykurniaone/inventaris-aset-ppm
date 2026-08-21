import { z } from "zod";

/**
 * Theme configuration shared by the root layout (which reads the cookie and
 * applies the `dark` class server-side, so there is no flash of the wrong
 * theme on load) and the theme-toggle server action. Mirrors
 * `src/i18n/config.ts` deliberately: same shape of problem — an untrusted
 * cookie value that must resolve to one of a small fixed set, defaulting
 * safely rather than crashing render.
 *
 * `src/app/globals.css` has no `prefers-color-scheme` media query; it is a
 * `.dark` class switch only. `"light"` is therefore the correct default, not
 * an arbitrary choice — it is what renders when no class is present at all.
 */
export const themes = ["light", "dark"] as const;

export type Theme = (typeof themes)[number];

export const defaultTheme: Theme = "light";

/**
 * The single source of truth for "is this string a supported theme",
 * shared between the server action that receives untrusted input
 * (`src/lib/set-theme.ts`) and the cookie-read fallback below.
 */
export const themeSchema = z.enum(themes);

/** Cookie the root layout reads and the theme toggle writes. */
export const THEME_COOKIE_NAME = "NEXT_THEME";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;

/** One year, so a returning visitor keeps their choice without re-selecting it. */
export const THEME_COOKIE_MAX_AGE_SECONDS =
  SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * DAYS_PER_YEAR;

/**
 * Resolves an arbitrary cookie value to a supported theme, falling back to
 * the default. A cookie tampered with, or left over from a removed theme,
 * must never crash render — this is defence in depth alongside the schema
 * above, not a substitute for it.
 */
export function resolveTheme(candidate: string | undefined): Theme {
  const result = themeSchema.safeParse(candidate);
  return result.success ? result.data : defaultTheme;
}
