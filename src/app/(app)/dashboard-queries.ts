import {
  buildAttentionCountWhere,
  buildLiveAssetWhere,
  computeTotalAcquisitionValue,
  shapeCategoryCounts,
  shapeStatusCounts,
  shapeYearCounts,
  type CategoryCountRow,
  type StatusCountRow,
  type YearCountRow,
} from "@/lib/dashboard-metrics";
import { db } from "@/lib/db";

/**
 * The dashboard's reads (PRD FR-9.1, FR-9.2). Every figure here is one
 * aggregate query — `count`, `groupBy`, or `aggregate` — against the `where`
 * and shaping helpers in `src/lib/dashboard-metrics.ts`; nothing loads the
 * asset table's rows into JavaScript to add them up, per the ticket's "a
 * dashboard that loads the whole asset table will not survive a real
 * register".
 *
 * `db` is called from several small functions rather than one large one so
 * `loadDashboardMetrics` can run them all with a single `Promise.all` and so
 * each stays comfortably under the project's 40-line limit.
 */

async function loadTotalAssetsCount(): Promise<number> {
  return db.asset.count({ where: buildLiveAssetWhere() });
}

async function loadAttentionCount(): Promise<number> {
  return db.asset.count({ where: buildAttentionCountWhere() });
}

async function loadStatusCounts(): Promise<readonly StatusCountRow[]> {
  const rows = await db.asset.groupBy({
    by: ["status"],
    where: buildLiveAssetWhere(),
    _count: true,
  });
  return shapeStatusCounts(rows);
}

/** Category names for the ids `loadCategoryCounts` grouped by — a plain
 * lookup, not a count, so it carries no aggregation logic of its own. */
async function loadCategoryNames(
  categoryIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (categoryIds.length === 0) {
    return new Map();
  }
  const categories = await db.category.findMany({
    where: { id: { in: [...categoryIds] } },
    select: { id: true, name: true },
  });
  return new Map(categories.map((category) => [category.id, category.name]));
}

async function loadCategoryCounts(): Promise<readonly CategoryCountRow[]> {
  const rows = await db.asset.groupBy({
    by: ["categoryId"],
    where: buildLiveAssetWhere(),
    _count: true,
  });
  const nameById = await loadCategoryNames(rows.map((row) => row.categoryId));
  return shapeCategoryCounts(rows, nameById);
}

async function loadYearCounts(): Promise<readonly YearCountRow[]> {
  const rows = await db.asset.groupBy({
    by: ["acquisitionYear"],
    where: buildLiveAssetWhere(),
    _count: true,
  });
  return shapeYearCounts(rows);
}

/** `null` when the caller did not ask for it — the staff-session case, where
 * FR-9.1's admin-only total must not even be computed, let alone sent. */
async function loadTotalAcquisitionValue(
  includeTotalValue: boolean,
): Promise<number | null> {
  if (!includeTotalValue) {
    return null;
  }
  const result = await db.asset.aggregate({
    where: buildLiveAssetWhere(),
    _sum: { purchasePrice: true },
  });
  return computeTotalAcquisitionValue(result._sum.purchasePrice);
}

export interface DashboardMetrics {
  readonly totalAssets: number;
  /** `null` for a staff session — see `loadTotalAcquisitionValue`. */
  readonly totalAcquisitionValue: number | null;
  readonly statusCounts: readonly StatusCountRow[];
  readonly attentionCount: number;
  readonly categoryCounts: readonly CategoryCountRow[];
  readonly yearCounts: readonly YearCountRow[];
}

export interface LoadDashboardMetricsOptions {
  /** Whether the caller's session is allowed to see the total acquisition
   * value at all (PRD FR-9.1: `admin` only). The caller — `page.tsx` — passes
   * this from `requireUser()`'s role, so a `staff` call never reaches the
   * `_sum` aggregate in the first place. */
  readonly includeTotalValue: boolean;
}

/**
 * Every dashboard figure, fetched in parallel. Six aggregate queries against
 * the asset table — never a `findMany` over it — plus one small lookup for
 * category labels.
 */
export async function loadDashboardMetrics({
  includeTotalValue,
}: LoadDashboardMetricsOptions): Promise<DashboardMetrics> {
  const [
    totalAssets,
    attentionCount,
    statusCounts,
    categoryCounts,
    yearCounts,
    totalAcquisitionValue,
  ] = await Promise.all([
    loadTotalAssetsCount(),
    loadAttentionCount(),
    loadStatusCounts(),
    loadCategoryCounts(),
    loadYearCounts(),
    loadTotalAcquisitionValue(includeTotalValue),
  ]);

  return {
    totalAssets,
    totalAcquisitionValue,
    statusCounts,
    attentionCount,
    categoryCounts,
    yearCounts,
  };
}
