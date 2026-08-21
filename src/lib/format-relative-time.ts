import type { Locale } from "@/i18n/config";

const LOCALE_TAGS: Readonly<Record<Locale, string>> = {
  id: "id-ID",
  en: "en-US",
};

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
/** Average weeks per month (365.25 / 12 / 7), so drift stays under a day a year. */
const WEEKS_PER_MONTH = 4.348;
const MONTHS_PER_YEAR = 12;

interface UnitStep {
  readonly limit: number;
  readonly unit: Intl.RelativeTimeFormatUnit;
  readonly divideBy: number;
}

/**
 * Each step says: while the remaining duration (in the previous step's
 * unit) is under `limit`, format at `unit`; otherwise divide by `divideBy`
 * and try the next step. `year` is not listed: once every step above is
 * exhausted, the remaining duration is already expressed in years.
 */
const UNIT_STEPS: readonly UnitStep[] = [
  { limit: SECONDS_PER_MINUTE, unit: "second", divideBy: SECONDS_PER_MINUTE },
  { limit: MINUTES_PER_HOUR, unit: "minute", divideBy: MINUTES_PER_HOUR },
  { limit: HOURS_PER_DAY, unit: "hour", divideBy: HOURS_PER_DAY },
  { limit: DAYS_PER_WEEK, unit: "day", divideBy: DAYS_PER_WEEK },
  { limit: WEEKS_PER_MONTH, unit: "week", divideBy: WEEKS_PER_MONTH },
  { limit: MONTHS_PER_YEAR, unit: "month", divideBy: MONTHS_PER_YEAR },
];

/**
 * Renders `date` relative to `now` — `"2 jam yang lalu"` / `"2 hours ago"`
 * for the past, `"dalam 3 hari"` / `"in 3 days"` for the future. Used by the
 * activity timeline (past events) and the loan overdue display (a due date
 * that may be in the past or the future).
 */
export function formatRelativeTime(
  date: Date,
  locale: Locale,
  now: Date = new Date(),
): string {
  const formatter = new Intl.RelativeTimeFormat(LOCALE_TAGS[locale], {
    numeric: "auto",
  });
  let duration = (date.getTime() - now.getTime()) / 1000;

  for (const step of UNIT_STEPS) {
    if (Math.abs(duration) < step.limit) {
      return formatter.format(Math.round(duration), step.unit);
    }
    duration /= step.divideBy;
  }

  return formatter.format(Math.round(duration), "year");
}
