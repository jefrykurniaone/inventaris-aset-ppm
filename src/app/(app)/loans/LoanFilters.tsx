import Link from "next/link";

import {
  AssetFilterSelect,
  AssetFilterTextInput,
} from "@/app/(app)/assets/AssetFilterFields";
import { HiddenSearchParams } from "@/components/HiddenSearchParams";
import { Button } from "@/components/ui/button";
import { LOAN_STATES } from "@/lib/loan-transitions";
import { LOANS_PATH } from "@/lib/paths";

import { LOAN_STATE_LABEL_KEYS, type LoansTranslate } from "./loan-field-specs";
import {
  buildLoanListViewParams,
  type LoanListSearchParams,
} from "./list-schemas";

/**
 * The loans list's search-and-filter form (PRD FR-6). One plain `GET` form with
 * no client-side JavaScript, so choosing a filter never triggers an unannounced
 * page change (WCAG 3.2.2) — the pattern `AssetFilters` sets.
 *
 * `page` is deliberately not one of this form's fields, so submitting always
 * lands on page 1 and a changed filter drops whatever page number was in the
 * URL before it.
 *
 * The two labelled controls are imported from the asset list rather than
 * copied. They are a `<label>` plus an `<input>` and a `<label>` plus a
 * `<select>`, with no asset-specific behaviour of any kind; a verbatim second
 * pair here would be two more places for the focus ring and the error-free
 * `GET`-form contract to drift apart.
 */

interface LoanFiltersProps {
  readonly params: LoanListSearchParams;
  readonly t: LoansTranslate;
}

export function LoanFilters({ params, t }: Readonly<LoanFiltersProps>) {
  const stateOptions = LOAN_STATES.map((state) => ({
    id: state,
    label: t(LOAN_STATE_LABEL_KEYS[state]),
  }));

  return (
    <form
      action={LOANS_PATH}
      method="get"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <AssetFilterTextInput
        id="loan-list-q"
        name="q"
        label={t("filterSearchLabel")}
        defaultValue={params.q ?? ""}
        inputMode="search"
      />
      <AssetFilterSelect
        id="loan-list-state"
        name="state"
        label={t("filterStateLabel")}
        allLabel={t("filterStateAll")}
        defaultValue={params.state ?? ""}
        options={stateOptions}
      />
      <HiddenSearchParams params={buildLoanListViewParams(params)} />
      <div className="flex items-end gap-2">
        <Button type="submit">{t("filterSubmit")}</Button>
        <Button asChild variant="outline">
          <Link href={LOANS_PATH}>{t("filterReset")}</Link>
        </Button>
      </div>
    </form>
  );
}
