import type { AssetStatus } from "@/app/(app)/assets/schemas";
import type { db } from "@/lib/db";

import { buildAttentionWhere } from "./asset-attention";
import { buildMissingPhotoWhere } from "./asset-missing-photo";

/**
 * Pure query-shape builders and result-shaping functions for the dashboard
 * (PRD FR-9.1, FR-9.2). Kept apart from `src/app/(app)/dashboard-queries.ts`
 * for the same reason `asset-list-query.ts` is kept apart from
 * `assets/list-queries.ts`: this module touches no database and no
 * `next/headers`, so every function here is unit-testable with a plain
 * object in, a plain object out — the acceptance criterion "aggregation is
 * done in SQL, verified by inspecting the queries" needs a `where`/`groupBy`
 * shape to inspect, not a live result set.
 */

/** The `where` clause every dashboard figure shares: live assets only
 * (PRD FR-2.5 applies here too — a soft-deleted asset counts nowhere on the
 * dashboard). Derived from `db` itself, not hand-typed, for the same reason
 * `AssetListWhere` is in `asset-list-query.ts`. */
type AssetCountArgs = NonNullable<Parameters<typeof db.asset.count>[0]>;
export type DashboardAssetWhere = NonNullable<AssetCountArgs["where"]>;

export function buildLiveAssetWhere(): DashboardAssetWhere {
  return { deletedAt: null };
}

/** The "requiring attention" count's `where` (FR-9.1): live assets only,
 * ANDed with the shared attention rule from `asset-attention.ts`. */
export function buildAttentionCountWhere(): DashboardAssetWhere {
  return {
    ...buildLiveAssetWhere(),
    ...buildAttentionWhere(),
  } as DashboardAssetWhere;
}

/** The "missing photo" count's `where` (spec #138): live assets only, ANDed
 * with the shared missing-photo rule from `asset-missing-photo.ts`. */
export function buildMissingPhotoCountWhere(): DashboardAssetWhere {
  return {
    ...buildLiveAssetWhere(),
    ...buildMissingPhotoWhere(),
  } as DashboardAssetWhere;
}

/** All five statuses, in the order the status breakdown card renders them —
 * fixed, not derived from whichever statuses happen to have a live asset, so
 * a status with zero assets still gets its own zeroed row (FR-9.1: "across
 * all five statuses"). */
export const ASSET_STATUS_ORDER: readonly AssetStatus[] = [
  "active",
  "in_repair",
  "loaned",
  "retired",
  "lost",
];

export interface StatusCountRow {
  readonly status: AssetStatus;
  readonly count: number;
}

interface StatusGroupResult {
  readonly status: AssetStatus;
  readonly _count: number;
}

/** Fills in a zero row for every status `db.asset.groupBy` omitted — Prisma's
 * `groupBy` never emits a row for a status with no matching asset, so the
 * gaps are filled here rather than by trusting the result set to be
 * complete. */
export function shapeStatusCounts(
  rows: readonly StatusGroupResult[],
): readonly StatusCountRow[] {
  const countByStatus = new Map(rows.map((row) => [row.status, row._count]));
  return ASSET_STATUS_ORDER.map((status) => ({
    status,
    count: countByStatus.get(status) ?? 0,
  }));
}

export interface CategoryCountRow {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly count: number;
}

interface CategoryGroupResult {
  readonly categoryId: string;
  readonly _count: number;
}

/** Sorted by count descending — the chart's most useful reading order — with
 * category name as an alphabetical tiebreak so two equal counts render in a
 * stable order across renders. A `categoryId` missing from `nameById` (which
 * should not happen against live data — every asset's category is a required
 * foreign key) falls back to the id itself rather than an empty label. */
export function shapeCategoryCounts(
  rows: readonly CategoryGroupResult[],
  nameById: ReadonlyMap<string, string>,
): readonly CategoryCountRow[] {
  return rows
    .map((row) => ({
      categoryId: row.categoryId,
      categoryName: nameById.get(row.categoryId) ?? row.categoryId,
      count: row._count,
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.categoryName.localeCompare(b.categoryName),
    );
}

export interface YearCountRow {
  readonly year: number;
  readonly count: number;
}

interface YearGroupResult {
  readonly acquisitionYear: number;
  readonly _count: number;
}

/** Sorted ascending by year — the chart reads left-to-right as a timeline. */
export function shapeYearCounts(
  rows: readonly YearGroupResult[],
): readonly YearCountRow[] {
  return rows
    .map((row) => ({ year: row.acquisitionYear, count: row._count }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Prisma's `_sum.purchasePrice` is a `Decimal | null`: `null` when there is
 * no live asset with a price at all (an empty aggregate, not a zero one).
 * Both cases render as zero rupiah, which is why this returns a plain
 * `number` rather than preserving the distinction — the total value card has
 * no separate "no data" state from "IDR 0" (FR-9.1 asks for a total, not an
 * emptiness flag). Accepts anything `Number()` can read a `Decimal` as,
 * structurally, rather than importing the generated `Decimal` type — the same
 * seam `src/app/(app)/assets/activity.ts` keeps.
 */
export function computeTotalAcquisitionValue(
  sum: { toString(): string } | null | undefined,
): number {
  return sum === null || sum === undefined ? 0 : Number(sum);
}
