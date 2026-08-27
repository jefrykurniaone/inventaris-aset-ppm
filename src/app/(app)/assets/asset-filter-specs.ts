import type { AssetsPlainMessageKey } from "./asset-field-specs";

/**
 * The asset list's six master-data-and-enum filters, described as data
 * rather than six near-identical `<AssetFilterSelect>` blocks — the same
 * reasoning as `ASSET_DETAIL_FIELD_SPECS` in `asset-field-specs.ts`: written
 * out by hand, `AssetFilters` would run well past the project's 40-line
 * function limit, and "every filter has a label and an 'all' option" would
 * be a property re-checked six times instead of once.
 */
export type AssetFilterSelectName =
  | "categoryId"
  | "buildingId"
  | "roomId"
  | "status"
  | "condition"
  | "fundingSourceId";

export interface AssetFilterSelectSpec {
  readonly name: AssetFilterSelectName;
  readonly labelKey: AssetsPlainMessageKey;
  readonly allLabelKey: AssetsPlainMessageKey;
  /**
   * Rendered as a searchable combobox rather than a native `<select>` (issue
   * #88), matching the write form's two searchable pickers. Categories and
   * rooms grow without a bound; building, status, condition and funding source
   * do not, so those four stay native selects.
   */
  readonly isSearchable?: boolean;
}

export const ASSET_FILTER_SELECT_SPECS: readonly AssetFilterSelectSpec[] = [
  {
    name: "categoryId",
    labelKey: "filterCategoryLabel",
    allLabelKey: "filterAllCategories",
    isSearchable: true,
  },
  {
    name: "buildingId",
    labelKey: "filterBuildingLabel",
    allLabelKey: "filterAllBuildings",
  },
  {
    name: "roomId",
    labelKey: "filterRoomLabel",
    allLabelKey: "filterAllRooms",
    isSearchable: true,
  },
  {
    name: "status",
    labelKey: "filterStatusLabel",
    allLabelKey: "filterAllStatuses",
  },
  {
    name: "condition",
    labelKey: "filterConditionLabel",
    allLabelKey: "filterAllConditions",
  },
  {
    name: "fundingSourceId",
    labelKey: "filterFundingSourceLabel",
    allLabelKey: "filterAllFundingSources",
  },
];
