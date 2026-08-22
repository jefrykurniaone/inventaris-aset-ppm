import type { AssetsPlainMessageKey } from "@/app/(app)/assets/asset-field-specs";

import type { XlsxStyleName } from "./xlsx-cells";

/**
 * Which columns an asset export carries, and — the part that matters — which
 * columns are *selected from the database* for each role (issue #14).
 *
 * The rule #11 established for the public scan page applies here with the
 * split moved from audience to role: **a staff export must not name a
 * restricted column at all.** There is no single select with a filter applied
 * afterwards. There are two literal objects, and `asset-export-columns.test.ts`
 * walks the staff one recursively and fails if any name in
 * `RESTRICTED_ASSET_EXPORT_FIELDS` appears anywhere in it, nested selects
 * included. A column that is never selected cannot reach a workbook, a log
 * line, or a serverless function's memory, whatever a later edit does to the
 * shaping code downstream.
 *
 * Column headers reuse the `AssetsPage` message keys the list and the form
 * already use, rather than a parallel set in the export's own namespace:
 * "Kategori" is the same word in a table header, a form label and a
 * spreadsheet header, and two catalogues of it would drift.
 */

/** Every column the export can carry, public half first. Written as a union
 * rather than derived from the arrays below so that `VALUE_READERS` in
 * `asset-export.ts` is a total map — a new column is a compile error there
 * until it has a value to put in the cell. */
export type AssetExportColumnId =
  | "assetCode"
  | "name"
  | "category"
  | "building"
  | "room"
  | "brand"
  | "model"
  | "serialNumber"
  | "universityAssetCode"
  | "condition"
  | "status"
  | "acquisitionYear"
  | "notes"
  | "purchasePrice"
  | "fundingSource"
  | "procurementDocNo"
  | "vendor"
  | "warrantyUntil"
  | "custodianName"
  | "custodianEmail";

export interface AssetExportColumn {
  readonly id: AssetExportColumnId;
  readonly labelKey: AssetsPlainMessageKey;
  readonly style: XlsxStyleName;
}

/** The thirteen columns every signed-in role exports. Order is the order the
 * ticket lists them in, which is also the order of PRD §8.2's public half. */
const PUBLIC_EXPORT_COLUMNS = [
  { id: "assetCode", labelKey: "assetCodeLabel", style: "text" },
  { id: "name", labelKey: "nameLabel", style: "text" },
  { id: "category", labelKey: "categoryLabel", style: "text" },
  // The building has no column label of its own outside the filter bar; the
  // filter's label is the same noun and is already translated in both files.
  { id: "building", labelKey: "filterBuildingLabel", style: "text" },
  { id: "room", labelKey: "roomLabel", style: "text" },
  { id: "brand", labelKey: "brandLabel", style: "text" },
  { id: "model", labelKey: "modelLabel", style: "text" },
  { id: "serialNumber", labelKey: "serialNumberLabel", style: "text" },
  {
    id: "universityAssetCode",
    labelKey: "universityAssetCodeLabel",
    style: "text",
  },
  { id: "condition", labelKey: "conditionLabel", style: "text" },
  { id: "status", labelKey: "statusLabel", style: "text" },
  // `integer`, never `currency` or a grouped format: a year is a label, not a
  // quantity, and `2.026` in an Indonesian locale is the defect this pins.
  { id: "acquisitionYear", labelKey: "acquisitionYearLabel", style: "integer" },
  { id: "notes", labelKey: "notesLabel", style: "text" },
] as const satisfies readonly AssetExportColumn[];

/** The six commercial columns and the custodian, for an `admin` only. */
const RESTRICTED_EXPORT_COLUMNS = [
  { id: "purchasePrice", labelKey: "purchasePriceLabel", style: "currency" },
  { id: "fundingSource", labelKey: "fundingSourceLabel", style: "text" },
  { id: "procurementDocNo", labelKey: "procurementDocNoLabel", style: "text" },
  { id: "vendor", labelKey: "vendorLabel", style: "text" },
  { id: "warrantyUntil", labelKey: "warrantyUntilLabel", style: "date" },
  { id: "custodianName", labelKey: "custodianNameLabel", style: "text" },
  { id: "custodianEmail", labelKey: "custodianEmailLabel", style: "text" },
] as const satisfies readonly AssetExportColumn[];

export const ADMIN_EXPORT_COLUMNS: readonly AssetExportColumn[] = [
  ...PUBLIC_EXPORT_COLUMNS,
  ...RESTRICTED_EXPORT_COLUMNS,
];

export const STAFF_EXPORT_COLUMNS: readonly AssetExportColumn[] =
  PUBLIC_EXPORT_COLUMNS;

export function assetExportColumnsFor(
  isAdmin: boolean,
): readonly AssetExportColumn[] {
  return isAdmin ? ADMIN_EXPORT_COLUMNS : STAFF_EXPORT_COLUMNS;
}

/**
 * The restricted half by *Prisma field name*, both sides of each relation —
 * naming either the scalar foreign key or the relation field in a staff
 * select is the same leak. This is the list the test iterates, so adding a
 * restricted column to the schema and forgetting this file is a test failure
 * rather than a review question.
 */
export const RESTRICTED_ASSET_EXPORT_FIELDS = [
  "purchasePrice",
  "fundingSourceId",
  "fundingSource",
  "procurementDocNo",
  "vendor",
  "warrantyUntil",
  "custodianName",
  "custodianEmail",
] as const;

/**
 * `id` is here for the cursor, not for the workbook: the export pages through
 * the register by primary key (see `asset-export-queries.ts`) and no column
 * renders it.
 */
const PUBLIC_ASSET_EXPORT_SELECT = {
  id: true,
  assetCode: true,
  name: true,
  brand: true,
  model: true,
  serialNumber: true,
  universityAssetCode: true,
  condition: true,
  status: true,
  acquisitionYear: true,
  notes: true,
  category: { select: { name: true } },
  room: { select: { name: true, building: { select: { name: true } } } },
} as const;

const RESTRICTED_ASSET_EXPORT_SELECT = {
  purchasePrice: true,
  procurementDocNo: true,
  vendor: true,
  warrantyUntil: true,
  custodianName: true,
  custodianEmail: true,
  fundingSource: { select: { name: true } },
} as const;

/** What a `staff` export selects. Written out as its own object, never
 * derived by removing keys from the admin one. */
export const STAFF_ASSET_EXPORT_SELECT = PUBLIC_ASSET_EXPORT_SELECT;

export const ADMIN_ASSET_EXPORT_SELECT = {
  ...PUBLIC_ASSET_EXPORT_SELECT,
  ...RESTRICTED_ASSET_EXPORT_SELECT,
} as const;

/**
 * The selection one role is allowed to read. The union return type rather
 * than a widened common shape, so a caller that branches on the role still
 * gets Prisma's exact row type for the branch it took — the same reasoning as
 * `assetScanSelectFor` in `asset-visibility.ts`.
 */
export function assetExportSelectFor(
  isAdmin: boolean,
): typeof STAFF_ASSET_EXPORT_SELECT | typeof ADMIN_ASSET_EXPORT_SELECT {
  if (isAdmin) {
    return ADMIN_ASSET_EXPORT_SELECT;
  }
  return STAFF_ASSET_EXPORT_SELECT;
}
