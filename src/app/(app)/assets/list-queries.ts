import {
  buildAssetListOrderBy,
  buildAssetListPageWindow,
  buildAssetListWhere,
  type AssetListQueryInput,
} from "@/lib/asset-list-query";
import { db } from "@/lib/db";

import type { AssetCondition, AssetOption, AssetStatus } from "./schemas";

/**
 * Reads for the asset list (issue #8): PRD FR-2.6's filtered, sorted,
 * paginated register view. Split out of `queries.ts` — #7's create/edit
 * reads — once the combined file passed the project's 300-line limit; the
 * split runs along the same seam as the two tickets themselves.
 *
 * This is the one place that departs from `queries.ts`'s public/restricted
 * note: the list never selects `purchasePrice`, `fundingSourceId`,
 * `procurementDocNo`, `vendor`, `warrantyUntil`, `custodianName` or
 * `custodianEmail` at all, for every signed-in role. That is narrower than
 * the audience split PRD §8.2 draws (signed-in versus anonymous) on
 * purpose — the ticket names it as a rule for the list's columns
 * specifically, this list has no admin-only rendering path to put a
 * financial column behind, and a query that never selects these columns
 * cannot leak them regardless of who is looking at the response.
 */

export interface AssetListRow {
  readonly id: string;
  readonly assetCode: string;
  readonly name: string;
  readonly categoryName: string;
  readonly roomName: string;
  readonly buildingName: string;
  readonly status: AssetStatus;
  readonly condition: AssetCondition;
  readonly acquisitionYear: number;
}

export interface AssetListPageResult {
  readonly rows: readonly AssetListRow[];
  readonly totalCount: number;
}

interface AssetListRowSource {
  readonly id: string;
  readonly assetCode: string;
  readonly name: string;
  readonly status: AssetStatus;
  readonly condition: AssetCondition;
  readonly acquisitionYear: number;
  readonly category: { readonly name: string };
  readonly room: {
    readonly name: string;
    readonly building: { readonly name: string };
  };
}

function toAssetListRow(asset: AssetListRowSource): AssetListRow {
  return {
    id: asset.id,
    assetCode: asset.assetCode,
    name: asset.name,
    categoryName: asset.category.name,
    roomName: asset.room.name,
    buildingName: asset.room.building.name,
    status: asset.status,
    condition: asset.condition,
    acquisitionYear: asset.acquisitionYear,
  };
}

/**
 * One page of the asset register (PRD FR-2.6): filtered, sorted and
 * paginated entirely at the database — `where`, `orderBy`, `skip` and `take`
 * all come from the pure translation in `@/lib/asset-list-query`, so the
 * acceptance criterion "verified by checking the query rather than the
 * rendered result" has a query to check. Soft-deleted assets are always
 * excluded (FR-2.5).
 *
 * No `photos` relation is read here. The photo pipeline (#9) is being built
 * in parallel and does not exist yet; the list renders a placeholder
 * thumbnail for every row until it does (`AssetThumbnailPlaceholder.tsx`).
 */
export async function listAssetsPage(
  query: AssetListQueryInput,
): Promise<AssetListPageResult> {
  const where = buildAssetListWhere(query);
  const orderBy = buildAssetListOrderBy(query.sortKey, query.sortDirection);
  const { skip, take } = buildAssetListPageWindow(query.page, query.pageSize);

  const [assets, totalCount] = await Promise.all([
    db.asset.findMany({
      where,
      orderBy,
      skip,
      take,
      select: {
        id: true,
        assetCode: true,
        name: true,
        status: true,
        condition: true,
        acquisitionYear: true,
        category: { select: { name: true } },
        room: { select: { name: true, building: { select: { name: true } } } },
      },
    }),
    db.asset.count({ where }),
  ]);

  return { rows: assets.map(toAssetListRow), totalCount };
}

export interface AssetListFilterOptions {
  readonly categories: readonly AssetOption[];
  readonly buildings: readonly AssetOption[];
  readonly rooms: readonly AssetOption[];
  readonly fundingSources: readonly AssetOption[];
}

interface CodeAndNameRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

interface RoomOptionRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly building: { readonly code: string };
}

interface NamedRow {
  readonly id: string;
  readonly name: string;
}

/**
 * Split out of `listAssetFilterOptions` so that function's own body stays
 * under the project's 40-line limit — the fetch is one concern, the label
 * formatting is another.
 *
 * This duplicates `listAssetFormOptions` below `queries.ts`'s label
 * formatting almost exactly. That duplication is deliberate, not an
 * oversight: this one feeds a *read* filter and deliberately includes
 * deactivated master data (see the comment on `listAssetFilterOptions`),
 * while `listAssetFormOptions` feeds a *write* picker and deliberately
 * excludes it (PRD FR-3.4). The two files have two different owners under
 * this repository's ticket-per-worktree model, and a shared helper would
 * couple them — leave the duplication alone rather than "fixing" it into
 * one.
 */
function mapAssetListFilterOptions(
  categories: readonly CodeAndNameRow[],
  buildings: readonly CodeAndNameRow[],
  rooms: readonly RoomOptionRow[],
  fundingSources: readonly NamedRow[],
): AssetListFilterOptions {
  return {
    categories: categories.map((category) => ({
      id: category.id,
      label: `${category.code} — ${category.name}`,
    })),
    buildings: buildings.map((building) => ({
      id: building.id,
      label: `${building.code} — ${building.name}`,
    })),
    rooms: rooms.map((room) => ({
      id: room.id,
      label: `${room.building.code} ${room.code} — ${room.name}`,
    })),
    fundingSources: fundingSources.map((fundingSource) => ({
      id: fundingSource.id,
      label: fundingSource.name,
    })),
  };
}

/**
 * Every category, building, room and funding source, for the list's filter
 * dropdowns — deactivated ones included, unlike `listAssetFormOptions` in
 * `queries.ts`. That function feeds a *write* picker (PRD FR-3.4: a
 * deactivated record should not be offered for a new assignment); this one
 * feeds a *read* filter, and an asset assigned to a category or room before
 * it was deactivated must stay findable by it.
 */
export async function listAssetFilterOptions(): Promise<AssetListFilterOptions> {
  const [categories, buildings, rooms, fundingSources] = await Promise.all([
    db.category.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.building.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.room.findMany({
      orderBy: [{ building: { code: "asc" } }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        building: { select: { code: true } },
      },
    }),
    db.fundingSource.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return mapAssetListFilterOptions(
    categories,
    buildings,
    rooms,
    fundingSources,
  );
}
