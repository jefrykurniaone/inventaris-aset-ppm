import type { useTranslations } from "next-intl";

import type {
  AssetCondition,
  AssetFieldName,
  AssetOption,
  AssetStatus,
} from "./schemas";

/**
 * The asset form, described as data rather than as eighteen near-identical
 * JSX blocks.
 *
 * Eighteen writable fields (PRD §8.2) written out by hand would put the form
 * component far past the project's 40-line function limit and its 300-line
 * file limit, and would make "every field has a label and an error slot" a
 * property that has to be re-checked eighteen times instead of once. The
 * order here is the order the user sees.
 */

export type AssetsTranslate = ReturnType<typeof useTranslations<"AssetsPage">>;
type AssetsMessageKey = Parameters<AssetsTranslate>[0];

/**
 * The keys that take no ICU values.
 *
 * `t(key)` where `key` is the union of *every* key in the namespace demands a
 * values argument, because one member of that union — `deleteConfirmTitle`,
 * which interpolates `{assetCode}` — needs one. Excluding it keeps every
 * label and placeholder below callable as a bare `t(key)`, and makes adding a
 * second parameterised key a compile error here rather than a runtime
 * `undefined` in the interface.
 */
export type AssetsPlainMessageKey = Exclude<
  AssetsMessageKey,
  "deleteConfirmTitle"
>;

/** The message key for each member of PRD FR-3.5's two fixed enumerations.
 * Declared in this plain module, not in a `"use client"` one, so the list
 * table (a Server Component) and the form (a Client Component) read the same
 * mapping instead of keeping two that can drift. */
export const CONDITION_LABEL_KEYS: Record<
  AssetCondition,
  AssetsPlainMessageKey
> = {
  good: "conditionGood",
  fair: "conditionFair",
  poor: "conditionPoor",
};

export const STATUS_LABEL_KEYS: Record<AssetStatus, AssetsPlainMessageKey> = {
  active: "statusActive",
  in_repair: "statusInRepair",
  loaned: "statusLoaned",
  retired: "statusRetired",
  lost: "statusLost",
};

/** Which picker list a select is fed from. The first three are master data
 * (`queries.ts`); the last two are PRD FR-3.5's fixed enumerations, whose
 * labels are built from the message catalogue at render time. */
export type AssetOptionsKey =
  "categories" | "rooms" | "fundingSources" | "conditions" | "statuses";

export type AssetOptionSets = Readonly<
  Record<AssetOptionsKey, readonly AssetOption[]>
>;

interface CommonFieldSpec {
  readonly name: AssetFieldName;
  readonly labelKey: AssetsPlainMessageKey;
  readonly isRequired?: boolean;
}

export interface AssetTextFieldSpec extends CommonFieldSpec {
  readonly kind: "text";
  readonly type?: "text" | "email" | "date" | "number";
  readonly inputMode?: "numeric" | "decimal";
}

export interface AssetSelectFieldSpec extends CommonFieldSpec {
  readonly kind: "select";
  readonly placeholderKey: AssetsPlainMessageKey;
  readonly optionsKey: AssetOptionsKey;
  /**
   * Rendered as a searchable combobox rather than a native `<select>` (issue
   * #88). Set on the master-data pickers whose lists grow without a bound —
   * categories and rooms — and left unset on the small fixed enumerations,
   * where a search box would be more work than scanning five entries.
   */
  readonly isSearchable?: boolean;
}

export interface AssetTextAreaFieldSpec extends CommonFieldSpec {
  readonly kind: "textarea";
}

export type AssetFieldSpec =
  AssetTextFieldSpec | AssetSelectFieldSpec | AssetTextAreaFieldSpec;

/** The public half of §8.2 — everything an anonymous scan may see. */
export const ASSET_DETAIL_FIELD_SPECS: readonly AssetFieldSpec[] = [
  { kind: "text", name: "name", labelKey: "nameLabel", isRequired: true },
  {
    kind: "select",
    name: "categoryId",
    labelKey: "categoryLabel",
    placeholderKey: "categoryPlaceholder",
    optionsKey: "categories",
    isRequired: true,
    isSearchable: true,
  },
  {
    kind: "select",
    name: "roomId",
    labelKey: "roomLabel",
    placeholderKey: "roomPlaceholder",
    optionsKey: "rooms",
    isRequired: true,
    isSearchable: true,
  },
  {
    kind: "select",
    name: "condition",
    labelKey: "conditionLabel",
    placeholderKey: "conditionPlaceholder",
    optionsKey: "conditions",
    isRequired: true,
  },
  {
    kind: "select",
    name: "status",
    labelKey: "statusLabel",
    placeholderKey: "statusPlaceholder",
    optionsKey: "statuses",
    isRequired: true,
  },
  {
    kind: "text",
    name: "acquisitionYear",
    labelKey: "acquisitionYearLabel",
    type: "number",
    inputMode: "numeric",
    isRequired: true,
  },
  { kind: "text", name: "brand", labelKey: "brandLabel" },
  { kind: "text", name: "model", labelKey: "modelLabel" },
  { kind: "text", name: "serialNumber", labelKey: "serialNumberLabel" },
  {
    kind: "text",
    name: "universityAssetCode",
    labelKey: "universityAssetCodeLabel",
  },
  { kind: "textarea", name: "notes", labelKey: "notesLabel" },
];

/**
 * The restricted half of §8.2: commercial figures and one named staff
 * member's contact details. Restricted on *read by audience*, never by role —
 * FR-1.4 lets `staff` create and edit assets, so these are writable here by
 * both roles and simply never selected by the public scan query (#11).
 */
export const ASSET_PROCUREMENT_FIELD_SPECS: readonly AssetFieldSpec[] = [
  {
    kind: "text",
    name: "purchasePrice",
    labelKey: "purchasePriceLabel",
    inputMode: "decimal",
  },
  {
    kind: "select",
    name: "fundingSourceId",
    labelKey: "fundingSourceLabel",
    placeholderKey: "fundingSourcePlaceholder",
    optionsKey: "fundingSources",
  },
  { kind: "text", name: "procurementDocNo", labelKey: "procurementDocNoLabel" },
  { kind: "text", name: "vendor", labelKey: "vendorLabel" },
  {
    kind: "text",
    name: "warrantyUntil",
    labelKey: "warrantyUntilLabel",
    type: "date",
  },
  { kind: "text", name: "custodianName", labelKey: "custodianNameLabel" },
  {
    kind: "text",
    name: "custodianEmail",
    labelKey: "custodianEmailLabel",
    type: "email",
  },
];
