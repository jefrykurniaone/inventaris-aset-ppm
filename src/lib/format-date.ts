import { LOCALE_TAGS, type Locale } from "@/i18n/config";

/**
 * Every asset, loan, and activity date in this system belongs to Direktorat
 * PPM at Telkom University. Pinning the time zone — rather than letting
 * `Intl` fall back to the host's — keeps a date rendered on the server
 * identical to the same date rendered in the browser, regardless of where
 * either happens to run.
 */
const TIME_ZONE = "Asia/Jakarta";

/** `21 Agustus 2026` / `August 21, 2026`. */
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** `21 Agustus 2026, 14.05` / `August 21, 2026, 2:05 PM`. */
export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
