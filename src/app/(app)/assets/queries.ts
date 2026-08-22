import {
  buildAssetListOrderBy,
  buildAssetListPageWindow,
  buildAssetListWhere,
  type AssetListQueryInput,
} from "@/lib/asset-list-query";
import { db } from "@/lib/db";

import {
  PRICE_DECIMAL_PLACES,
  type AssetCondition,
  type AssetFormDefaults,
  type AssetFormOptions,
  type AssetOption,
  type AssetStatus,
} from "./schemas";

/**
 * Reads for the asset register. Both the list and the edit form are
 * signed-in surfaces, so both may select the restricted half of PRD §8.2 —
 * the public/restricted split is enforced on the *public* scan query (#11),
 * which selects the public columns and no others.
 *
 * The asset list (issue #8) is the one exception: it never selects
 * `purchasePrice`, `fundingSourceId`, `procurementDocNo`, `vendor`,
 * `warrantyUntil`, `custodianName` or `custodianEmail` at all, for every
 * signed-in role. That is narrower than the audience split above on
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

/**
 * Every category, building, room and funding source, for the list's filter
 * dropdowns — deactivated ones included, unlike `listAssetFormOptions`
 * below. That function feeds a *write* picker (PRD FR-3.4: a deactivated
 * record should not be offered for a new assignment); this one feeds a
 * *read* filter, and an asset assigned to a category or room before it was
 * deactivated must stay findable by it.
 */
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

/** Split out of `listAssetFilterOptions` so that function's own body stays
 * under the project's 40-line limit — the fetch is one concern, the label
 * formatting is another. */
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

export interface AssetForEdit {
  readonly id: string;
  readonly assetCode: string;
  readonly defaults: AssetFormDefaults;
}

const ISO_DATE_LENGTH = "YYYY-MM-DD".length;

function toDateInputValue(value: Date | null): string {
  return value === null ? "" : value.toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * One asset, ready to populate the edit form.
 *
 * `assetCode` comes back separately from `defaults` because it is *not* a
 * writable field. It is issued once at creation and never regenerated, not
 * even when the category or the acquisition year below it changes: the label
 * carrying it is already glued to the physical item, and FR-2.2's "stable
 * across renumbering" is the same promise made about `qrToken`. Editing an
 * asset's category is a correction to the record, not a renumbering of the
 * sticker on its side.
 */
export async function findAssetForEdit(
  id: string,
): Promise<AssetForEdit | null> {
  const asset = await db.asset.findFirst({ where: { id, deletedAt: null } });
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    assetCode: asset.assetCode,
    defaults: {
      name: asset.name,
      categoryId: asset.categoryId,
      roomId: asset.roomId,
      condition: asset.condition,
      status: asset.status,
      acquisitionYear: String(asset.acquisitionYear),
      brand: asset.brand ?? "",
      model: asset.model ?? "",
      serialNumber: asset.serialNumber ?? "",
      universityAssetCode: asset.universityAssetCode ?? "",
      notes: asset.notes ?? "",
      purchasePrice: asset.purchasePrice?.toFixed(PRICE_DECIMAL_PLACES) ?? "",
      fundingSourceId: asset.fundingSourceId ?? "",
      procurementDocNo: asset.procurementDocNo ?? "",
      vendor: asset.vendor ?? "",
      warrantyUntil: toDateInputValue(asset.warrantyUntil),
      custodianName: asset.custodianName ?? "",
      custodianEmail: asset.custodianEmail ?? "",
    },
  };
}

/** Deactivated master data is hidden from the pickers (PRD FR-3.4) — except
 * the record this asset already points at, which stays selectable so that
 * editing an unrelated field cannot silently drop it. */
function activeOrSelected(selectedId: string | undefined) {
  if (!selectedId) {
    return { isActive: true };
  }
  return { OR: [{ isActive: true }, { id: selectedId }] };
}

export interface SelectedAssetReferences {
  readonly categoryId?: string;
  readonly roomId?: string;
  readonly fundingSourceId?: string;
}

export async function listAssetFormOptions(
  selected: SelectedAssetReferences = {},
): Promise<AssetFormOptions> {
  const [categories, rooms, fundingSources] = await Promise.all([
    db.category.findMany({
      where: activeOrSelected(selected.categoryId),
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.room.findMany({
      where: activeOrSelected(selected.roomId),
      orderBy: [{ building: { code: "asc" } }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        building: { select: { code: true } },
      },
    }),
    db.fundingSource.findMany({
      where: activeOrSelected(selected.fundingSourceId),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      label: `${category.code} — ${category.name}`,
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
