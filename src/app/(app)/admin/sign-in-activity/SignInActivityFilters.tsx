import Link from "next/link";

import {
  AssetFilterSelect,
  AssetFilterTextInput,
} from "@/app/(app)/assets/AssetFilterFields";
import { HiddenSearchParams } from "@/components/HiddenSearchParams";
import { Button } from "@/components/ui/button";
import { ADMIN_SIGN_IN_ACTIVITY_PATH } from "@/lib/paths";
import {
  buildSignInActivityListViewParams,
  type SignInActivityListParams,
} from "@/lib/sign-in-activity-list-query";
import { SIGN_IN_ATTEMPT_OUTCOMES } from "@/lib/sign-in-lockout";

import {
  SIGN_IN_ATTEMPT_OUTCOME_LABEL_KEYS,
  type AdminSignInActivityTranslate,
} from "./sign-in-activity-field-specs";

/**
 * The trail's search-and-filter form (issue #125). One plain `GET` form with
 * no client-side JavaScript, so choosing an outcome never triggers an
 * unannounced page change (WCAG 3.2.2) — the pattern `../../loans/LoanFilters`
 * sets, and the two labelled controls below are the very same components,
 * imported rather than copied so the focus ring and the error-free `GET`-form
 * contract cannot drift between the two lists.
 *
 * `page` is deliberately not one of this form's fields, so submitting always
 * lands on page 1 and a changed filter drops whatever page number was in the
 * URL before it.
 */

interface SignInActivityFiltersProps {
  readonly params: SignInActivityListParams;
  readonly t: AdminSignInActivityTranslate;
}

export function SignInActivityFilters({
  params,
  t,
}: Readonly<SignInActivityFiltersProps>) {
  const outcomeOptions = SIGN_IN_ATTEMPT_OUTCOMES.map((outcome) => ({
    id: outcome,
    label: t(SIGN_IN_ATTEMPT_OUTCOME_LABEL_KEYS[outcome]),
  }));

  return (
    <form
      action={ADMIN_SIGN_IN_ACTIVITY_PATH}
      method="get"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <AssetFilterTextInput
        id="sign-in-activity-search"
        name="search"
        label={t("filterSearchLabel")}
        defaultValue={params.search ?? ""}
        inputMode="search"
      />
      <AssetFilterSelect
        id="sign-in-activity-outcome"
        name="outcome"
        label={t("filterOutcomeLabel")}
        allLabel={t("filterOutcomeAll")}
        defaultValue={params.outcome ?? ""}
        options={outcomeOptions}
      />
      <HiddenSearchParams params={buildSignInActivityListViewParams(params)} />
      <div className="flex items-end gap-2">
        <Button type="submit">{t("filterSubmit")}</Button>
        <Button asChild variant="outline">
          <Link href={ADMIN_SIGN_IN_ACTIVITY_PATH}>{t("filterReset")}</Link>
        </Button>
      </div>
    </form>
  );
}
