import { db } from "@/lib/db";

import {
  PRICE_DECIMAL_PLACES,
  type AssetFormDefaults,
  type AssetFormOptions,
} from "./schemas";

/**
 * Reads for the asset register's create-and-edit form (issue #7). Both this
 * and the edit form are signed-in surfaces, so both may select the
 * restricted half of PRD §8.2 — the public/restricted split is enforced on
 * the *public* scan query (#11), which selects the public columns and no
 * others.
 *
 * The asset list (issue #8) departs from that: see the note at the top of
 * `list-queries.ts` for why its query never selects the restricted columns
 * at all, for every role.
 */

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
        building: { select: { code: true, name: true } },
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
    // `group` is the heading the searchable rooms picker lists the room under
    // (issue #88); the `orderBy` above is what puts one building's rooms next
    // to each other, so the grouping is a reading of the query's order.
    rooms: rooms.map((room) => ({
      id: room.id,
      label: `${room.building.code} ${room.code} — ${room.name}`,
      group: `${room.building.code} — ${room.building.name}`,
    })),
    fundingSources: fundingSources.map((fundingSource) => ({
      id: fundingSource.id,
      label: fundingSource.name,
    })),
  };
}
