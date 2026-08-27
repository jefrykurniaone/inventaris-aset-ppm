import type { getTranslations } from "next-intl/server";

import type { SignInAttemptOutcome } from "@/lib/sign-in-lockout";

/**
 * The sign-in activity trail's shared message-key mapping (issue #125), in a
 * plain module with no JSX and no server-only import, so the page, its filter
 * form and its table row all read the same mapping rather than three that can
 * drift. The same role `../../loans/loan-field-specs.ts` plays for the loan
 * register.
 */

export type AdminSignInActivityTranslate = Awaited<
  ReturnType<typeof getTranslations<"AdminSignInActivityPage">>
>;

type AdminSignInActivityMessageKey =
  Parameters<AdminSignInActivityTranslate>[0];

/** The keys callable as a bare `t(key)` — every one except `retentionNote`,
 * which interpolates the retention window. Excluding it here makes adding a
 * second interpolated key a compile error at its call site rather than a
 * runtime `undefined`. */
export type AdminSignInActivityPlainMessageKey = Exclude<
  AdminSignInActivityMessageKey,
  "retentionNote"
>;

/** The label for each of the three outcomes in `SIGN_IN_ATTEMPT_OUTCOMES`,
 * shared between the row and the filter form's `<select>`. */
export const SIGN_IN_ATTEMPT_OUTCOME_LABEL_KEYS: Readonly<
  Record<SignInAttemptOutcome, AdminSignInActivityPlainMessageKey>
> = {
  succeeded: "outcomeSucceeded",
  failed: "outcomeFailed",
  blocked: "outcomeBlocked",
};
