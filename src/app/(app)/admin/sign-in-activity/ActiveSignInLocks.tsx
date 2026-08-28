import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format-date";
import type { ActiveSignInLock } from "@/lib/sign-in-active-locks";

import type { AdminSignInActivityTranslate } from "./sign-in-activity-field-specs";

interface ActiveSignInLocksProps {
  /** Already ordered soonest-to-unlock first by
   * `collectActiveSignInLocks` — this component does no shaping of its own. */
  readonly locks: readonly ActiveSignInLock[];
  readonly locale: Locale;
  readonly t: AdminSignInActivityTranslate;
}

/** The list itself, or the empty state. Split from the section below so each
 * function stays short, and declared at module scope rather than inside the
 * section's render (S6478). */
function ActiveSignInLocksBody({
  locks,
  locale,
  t,
}: Readonly<ActiveSignInLocksProps>) {
  if (locks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("activeLocksEmptyState")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="py-2 pr-4 font-medium">
              {t("columnAddress")}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {t("activeLocksColumnLockedAt")}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {t("activeLocksColumnUnlocksAt")}
            </th>
          </tr>
        </thead>
        <tbody>
          {locks.map((lock) => (
            <tr
              key={lock.email}
              className="border-border border-b last:border-0"
            >
              <td className="py-2 pr-4">{lock.email}</td>
              <td className="py-2 pr-4">
                {formatDateTime(lock.lockedAt, locale)}
              </td>
              <td className="py-2 pr-4">
                {formatDateTime(lock.lockedUntil, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The active-locks section at the top of the sign-in activity page (issue
 * #126): every address currently locked out of `/sign-in/email`, with when
 * its lock started and when it lifts.
 *
 * Read-only, so it carries no sort headers and no controls — a lock lifts by
 * itself and there is nothing here for an administrator to act on. `<section>`
 * with a heading rather than a `role`, per the semantic-elements-first rule.
 */
export function ActiveSignInLocks({
  locks,
  locale,
  t,
}: Readonly<ActiveSignInLocksProps>) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold tracking-tight">
        {t("activeLocksTitle")}
      </h2>
      <ActiveSignInLocksBody locks={locks} locale={locale} t={t} />
    </section>
  );
}
