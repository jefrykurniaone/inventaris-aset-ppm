import type { AssetCondition, AssetStatus } from "@/app/(app)/assets/schemas";

import type {
  AssetExportColumn,
  AssetExportColumnId,
} from "./asset-export-columns";
import {
  DEFAULT_ASSET_LIST_PAGE_SIZE,
  FIRST_ASSET_LIST_PAGE,
} from "./asset-list-query";
import {
  buildAssetListSearchParams,
  type AssetListUrlState,
} from "./asset-list-url";
import { ASSETS_EXPORT_PATH } from "./paths";
import type { XlsxCell, XlsxCellValue } from "./xlsx-cells";

/**
 * Turning asset rows into spreadsheet cells (issue #14).
 *
 * Everything here is pure: no database, no `next/headers`, no file writing.
 * That is what lets the acceptance criteria the ticket cares about — the
 * column set per role, prices as numbers rather than formatted text, dates as
 * dates, the year without a thousands separator, the size guard, the filename
 * — be asserted directly in `asset-export.test.ts`, rather than inferred from
 * a downloaded file nobody can open in CI.
 */

/** Prisma returns `Decimal` for a `@db.Decimal` column. Duck-typed rather
 * than imported, because `@/generated/prisma` may only be imported by
 * `src/lib/db.ts` (CLAUDE.md's seam rule) and `toNumber` is the only part of
 * it this module uses. */
export interface DecimalLike {
  readonly toNumber: () => number;
}

/**
 * One row as either export select returns it. The restricted half is optional
 * on purpose: a staff row genuinely does not carry those keys, because the
 * query never asked for them, and the type says so.
 */
export interface AssetExportSource {
  /** Selected for the export's cursor, never rendered into a column. */
  readonly id: string;
  readonly assetCode: string;
  readonly name: string;
  readonly category: { readonly name: string };
  readonly room: {
    readonly name: string;
    readonly building: { readonly name: string };
  };
  readonly brand: string | null;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly universityAssetCode: string | null;
  readonly condition: AssetCondition;
  readonly status: AssetStatus;
  readonly acquisitionYear: number;
  readonly notes: string | null;
  readonly purchasePrice?: DecimalLike | number | null;
  readonly fundingSource?: { readonly name: string } | null;
  readonly procurementDocNo?: string | null;
  readonly vendor?: string | null;
  readonly warrantyUntil?: Date | null;
  readonly custodianName?: string | null;
  readonly custodianEmail?: string | null;
}

/** The two fixed enumerations, already translated into the requesting user's
 * locale by the caller — this module never touches `next-intl`. */
export interface AssetExportLabels {
  readonly status: Readonly<Record<AssetStatus, string>>;
  readonly condition: Readonly<Record<AssetCondition, string>>;
}

/** A `Decimal` as a plain number, so the cell holds a number and the IDR
 * symbol lives in the cell format instead of in the value. */
export function toDecimalNumber(
  value: DecimalLike | number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  return value.toNumber();
}

type AssetExportValueReader = (
  row: AssetExportSource,
  labels: AssetExportLabels,
) => XlsxCellValue;

const VALUE_READERS: Readonly<
  Record<AssetExportColumnId, AssetExportValueReader>
> = {
  assetCode: (row) => row.assetCode,
  name: (row) => row.name,
  category: (row) => row.category.name,
  building: (row) => row.room.building.name,
  room: (row) => row.room.name,
  brand: (row) => row.brand,
  model: (row) => row.model,
  serialNumber: (row) => row.serialNumber,
  universityAssetCode: (row) => row.universityAssetCode,
  condition: (row, labels) => labels.condition[row.condition],
  status: (row, labels) => labels.status[row.status],
  acquisitionYear: (row) => row.acquisitionYear,
  notes: (row) => row.notes,
  purchasePrice: (row) => toDecimalNumber(row.purchasePrice),
  fundingSource: (row) => row.fundingSource?.name ?? null,
  procurementDocNo: (row) => row.procurementDocNo ?? null,
  vendor: (row) => row.vendor ?? null,
  warrantyUntil: (row) => row.warrantyUntil ?? null,
  custodianName: (row) => row.custodianName ?? null,
  custodianEmail: (row) => row.custodianEmail ?? null,
};

/** One spreadsheet row, in the given column order. */
export function toAssetExportCells(
  row: AssetExportSource,
  columns: readonly AssetExportColumn[],
  labels: AssetExportLabels,
): readonly XlsxCell[] {
  return columns.map((column) => ({
    value: VALUE_READERS[column.id](row, labels),
    style: column.style,
  }));
}

const MIN_COLUMN_WIDTH = 10;
const MAX_COLUMN_WIDTH = 48;
/** Room for the auto-filter dropdown arrow and a little air. */
const COLUMN_WIDTH_PADDING = 3;
/** A date renders as `yyyy-mm-dd`, whatever its serial number looks like. */
const DATE_DISPLAY_LENGTH = 10;

function displayLength(value: XlsxCellValue): number {
  if (value === null) {
    return 0;
  }
  if (value instanceof Date) {
    return DATE_DISPLAY_LENGTH;
  }
  return String(value).length;
}

function clampWidth(longest: number): number {
  const padded = longest + COLUMN_WIDTH_PADDING;
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, padded));
}

/**
 * Column widths sized to what is actually in the column.
 *
 * Measured over the headers plus a sample of body rows rather than the whole
 * export, because `<cols>` has to be written before the first `<row>` and the
 * whole export is never in memory at once — that is the trade the streaming
 * requirement forces. The sample is the first database chunk, which for a
 * sorted register is representative enough to stop a column being three
 * characters wide.
 */
export function measureColumnWidths(
  headers: readonly string[],
  sampleRows: readonly (readonly XlsxCell[])[],
): readonly number[] {
  return headers.map((header, index) => {
    let longest = header.length;
    for (const cells of sampleRows) {
      const cell = cells[index];
      const length = cell ? displayLength(cell.value) : 0;
      longest = Math.max(longest, length);
    }
    return clampWidth(longest);
  });
}

/**
 * How many rows one export may carry.
 *
 * A ceiling exists because a download is a synchronous promise to the person
 * who clicked it: a request that would take minutes should be refused with a
 * sentence they can act on ("narrow the filters") rather than time out behind
 * a spinner. Twenty thousand is comfortably above the register PRD §2 sizes
 * and comfortably below anything a serverless request budget minds.
 */
export const MAX_ASSET_EXPORT_ROWS = 20_000;

/** Rows per database round trip while streaming. Large enough that a full
 * export is tens of queries rather than thousands, small enough that only one
 * chunk of Prisma objects is ever live. */
export const ASSET_EXPORT_CHUNK_SIZE = 500;

export function isAssetExportTooLarge(totalCount: number): boolean {
  return totalCount > MAX_ASSET_EXPORT_ROWS;
}

/** The register is kept in Jakarta time, and an export run at 06:00 there is
 * still the previous UTC day — stamping the filename in UTC would name the
 * wrong date for the first seven hours of every working day. */
const EXPORT_TIME_ZONE = "Asia/Jakarta";

const EXPORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: EXPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `2026-08-22`. Not locale-dependent: a filename is sorted by a file
 * manager, not read as prose, and only one ordering sorts correctly. */
export function assetExportDateStamp(exportedAt: Date): string {
  return EXPORT_DATE_FORMATTER.format(exportedAt);
}

const EXPORT_FILE_PREFIX = "assets";
const EXPORT_FILE_EXTENSION = "xlsx";

export function assetExportFileName(exportedAt: Date): string {
  const stamp = assetExportDateStamp(exportedAt);
  return `${EXPORT_FILE_PREFIX}-${stamp}.${EXPORT_FILE_EXTENSION}`;
}

/**
 * The export link for the list state currently on screen — the same filters
 * and the same sort, so the two can never disagree about what is being
 * looked at.
 *
 * `page` and `pageSize` are reset to their defaults, which drops them from
 * the query string entirely: the export covers the whole filtered set, and a
 * `page=3` left in a download URL would invite exactly the wrong assumption
 * about what came back.
 */
export function buildAssetExportHref(state: AssetListUrlState): string {
  const query = buildAssetListSearchParams({
    ...state,
    page: FIRST_ASSET_LIST_PAGE,
    pageSize: DEFAULT_ASSET_LIST_PAGE_SIZE,
  }).toString();
  return query ? `${ASSETS_EXPORT_PATH}?${query}` : ASSETS_EXPORT_PATH;
}
