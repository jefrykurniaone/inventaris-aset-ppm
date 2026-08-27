import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format-date";

import type { SignInActivityListRow } from "./queries";
import {
  SIGN_IN_ATTEMPT_OUTCOME_LABEL_KEYS,
  type AdminSignInActivityTranslate,
} from "./sign-in-activity-field-specs";

interface SignInActivityRowProps {
  readonly attempt: SignInActivityListRow;
  readonly locale: Locale;
  readonly t: AdminSignInActivityTranslate;
}

/** One row of the trail: the attempted address, its localised outcome, and
 * its locale-formatted timestamp. Split out of `SignInActivityTable` so that
 * component stays a short list of calls, the same reason `UserRow` and
 * `LoanRow` are split out of their own tables. */
export function SignInActivityRow({
  attempt,
  locale,
  t,
}: Readonly<SignInActivityRowProps>) {
  return (
    <tr className="border-border border-b last:border-0">
      <td className="py-2 pr-4">{attempt.email}</td>
      <td className="py-2 pr-4">
        {t(SIGN_IN_ATTEMPT_OUTCOME_LABEL_KEYS[attempt.outcome])}
      </td>
      <td className="py-2 pr-4">{formatDateTime(attempt.createdAt, locale)}</td>
    </tr>
  );
}
