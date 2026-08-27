import Link from "next/link";

import { HiddenSearchParams } from "@/components/HiddenSearchParams";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/button";
import { buildAssetListViewParams } from "@/lib/asset-list-url";
import { ASSETS_PATH } from "@/lib/paths";

import type { AssetsTranslate } from "./asset-field-specs";
import { CONDITION_LABEL_KEYS, STATUS_LABEL_KEYS } from "./asset-field-specs";
import {
  ASSET_FILTER_SELECT_SPECS,
  type AssetFilterSelectName,
} from "./asset-filter-specs";
import { AssetFilterControl, AssetFilterTextInput } from "./AssetFilterFields";
import type { AssetListSearchParams } from "./list-schemas";
import type { AssetListFilterOptions } from "./list-queries";
import { ASSET_CONDITIONS, ASSET_STATUSES, type AssetOption } from "./schemas";

type OptionsByFilterName = Record<
  AssetFilterSelectName,
  readonly AssetOption[]
>;

/** Every select filter's option list, keyed the same way as
 * `ASSET_FILTER_SELECT_SPECS`. Built once per render rather than inside the
 * `.map()` below, so translating the two fixed enumerations happens once
 * each, not once per spec. */
function buildOptionsByFilterName(
  options: AssetListFilterOptions,
  t: AssetsTranslate,
): OptionsByFilterName {
  return {
    categoryId: options.categories,
    buildingId: options.buildings,
    roomId: options.rooms,
    fundingSourceId: options.fundingSources,
    status: ASSET_STATUSES.map((status) => ({
      id: status,
      label: t(STATUS_LABEL_KEYS[status]),
    })),
    condition: ASSET_CONDITIONS.map((condition) => ({
      id: condition,
      label: t(CONDITION_LABEL_KEYS[condition]),
    })),
  };
}

interface AssetFilterInputsProps {
  readonly params: AssetListSearchParams;
  readonly optionsByFilterName: OptionsByFilterName;
  readonly t: AssetsTranslate;
}

/** The free-text search box and the six spec-driven selects — split out of
 * `AssetFilters` so that component's own body stays under the project's
 * 40-line limit (the same reasoning as `AssetFieldset` in the write form). */
function AssetFilterInputs({
  params,
  optionsByFilterName,
  t,
}: Readonly<AssetFilterInputsProps>) {
  return (
    <>
      <AssetFilterTextInput
        id="asset-list-q"
        name="q"
        label={t("filterSearchLabel")}
        defaultValue={params.q ?? ""}
        inputMode="search"
      />
      {ASSET_FILTER_SELECT_SPECS.map((spec) => (
        <AssetFilterControl
          key={spec.name}
          spec={spec}
          defaultValue={params[spec.name] ?? ""}
          options={optionsByFilterName[spec.name]}
          t={t}
        />
      ))}
    </>
  );
}

/** The submit and reset controls. Reset is a plain link to `/assets` — the
 * shortest possible way to drop every filter and return to page 1. Submit is
 * the same `SubmitButton` every other form in this app uses (ticket #84): it
 * disables itself and announces `aria-busy` while the filter navigation is
 * in flight, via `useFormStatus` — which tracks this plain `method="get"`
 * form's submission the same way it tracks the action-based forms elsewhere,
 * `useFormStatus`'s `method` field being documented as `'get' | 'post'`
 * rather than always `'post'` is what confirms that. */
function AssetFilterActions({ t }: Readonly<{ t: AssetsTranslate }>) {
  return (
    <div className="flex items-end gap-2">
      <SubmitButton
        idleLabel={t("filterSubmit")}
        pendingLabel={t("filterSubmitPending")}
      />
      <Button asChild variant="outline">
        <Link href={ASSETS_PATH}>{t("filterReset")}</Link>
      </Button>
    </div>
  );
}

interface AssetFiltersProps {
  readonly params: AssetListSearchParams;
  readonly options: AssetListFilterOptions;
  readonly t: AssetsTranslate;
}

/**
 * The asset list's search-and-filter form (PRD FR-2.6): free text and seven
 * filters in one plain `GET` form — no client-side JavaScript, so choosing a
 * filter never triggers an unannounced page change (WCAG 3.2.2), matching
 * `RoomBuildingFilter`'s pattern. Submitting always lands on page 1: `page`
 * is never one of this form's fields, so a changed filter drops whatever page
 * number was in the URL before it.
 *
 * Sorting moved onto the column headers with issue #87, so the two sort
 * dropdowns are gone; the sort key, direction and page size ride along as
 * hidden fields instead, because a `GET` form replaces the query string
 * wholesale and applying a filter must not silently reset the ordering.
 */
export function AssetFilters({
  params,
  options,
  t,
}: Readonly<AssetFiltersProps>) {
  const optionsByFilterName = buildOptionsByFilterName(options, t);
  const acquisitionYearDefault = params.acquisitionYear
    ? String(params.acquisitionYear)
    : "";

  return (
    <form
      action={ASSETS_PATH}
      method="get"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <AssetFilterInputs
        params={params}
        optionsByFilterName={optionsByFilterName}
        t={t}
      />
      <AssetFilterTextInput
        id="asset-list-acquisition-year"
        name="acquisitionYear"
        label={t("filterAcquisitionYearLabel")}
        defaultValue={acquisitionYearDefault}
        type="number"
        inputMode="numeric"
      />
      <HiddenSearchParams params={buildAssetListViewParams(params)} />
      <AssetFilterActions t={t} />
    </form>
  );
}
