import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format-date";
import { formatRelativeTime } from "@/lib/format-relative-time";

import type { LoansTranslate } from "./loan-field-specs";

/**
 * One loan date, rendered twice over: the calendar date a reader scans a column
 * for, and underneath it the same instant in words, through the relative-time
 * helper from issue #5.
 *
 * Both are visible text rather than one hiding in a `title` attribute — a
 * `title` is not reachable by keyboard and not announced reliably, so it is a
 * decoration, not an alternative. The `dateTime` attribute carries the machine
 * form for anything parsing the page.
 *
 * The relative half is what makes an overdue loan legible at a glance: `Due 3
 * days ago` next to a date says the same thing the badge does, in a second
 * modality, without the reader doing arithmetic against today.
 */

interface LoanDateTimeProps {
  readonly value: Date;
  readonly locale: Locale;
  /** Which sentence the relative half is phrased as — `dueOn` for a due date,
   * `returnedOn` for a return. Both interpolate one `relative` value. */
  readonly relativeKey: "dueOn" | "returnedOn";
  readonly t: LoansTranslate;
}

export function LoanDateTime({
  value,
  locale,
  relativeKey,
  t,
}: Readonly<LoanDateTimeProps>) {
  return (
    <span className="flex flex-col">
      <time dateTime={value.toISOString()}>{formatDate(value, locale)}</time>
      <span className="text-muted-foreground text-xs">
        {t(relativeKey, { relative: formatRelativeTime(value, locale) })}
      </span>
    </span>
  );
}
