import { getLocale } from "next-intl/server";

import { db } from "@/lib/db";

import {
  PRICE_DECIMAL_PLACES,
  type AssetCondition,
  type AssetStatus,
} from "../schemas";

/**
 * The read for the asset detail page (issue #10): the full record, grouped
 * the way the page groups it (identity, location and condition, commercial,
 * custody). Both roles see every field selected here — this is an
 * authenticated route, and PRD §8.2's public/restricted split is the *public
 * scan page*'s rule (#11), not this one's. See the note at the top of
 * `../queries.ts` for the same reasoning applied to the create/edit form.
 *
 * `#11` has not merged at the time this was written, so its visibility
 * helper does not exist yet to reuse. Nothing here re-implements it: this
 * query selects every column for a signed-in reader, which is simply a
 * superset that does not need a visibility split at all.
 */

export interface AssetDetailRecord {
  readonly id: string;
  readonly assetCode: string;
  readonly qrToken: string;
  readonly name: string;
  readonly categoryName: string;
  readonly status: AssetStatus;
  readonly condition: AssetCondition;
  readonly roomName: string;
  readonly buildingName: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly universityAssetCode: string | null;
  readonly acquisitionYear: number;
  readonly notes: string | null;
  readonly purchasePrice: string | null;
  readonly fundingSourceName: string | null;
  readonly procurementDocNo: string | null;
  readonly vendor: string | null;
  readonly warrantyUntil: Date | null;
  readonly custodianName: string | null;
  readonly custodianEmail: string | null;
  readonly createdByName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A withdrawn record still carries enough to head the page (PRD FR-2.5: a
 * scan of a retired asset must not be a dead end, and neither should an
 * internal link to one — a colleague pasting a link to an asset someone
 * else just deleted should see what it was, not a raw 404).
 */
export interface WithdrawnAssetSummary {
  readonly assetCode: string;
  readonly name: string;
}

export type AssetDetailResult =
  | { readonly kind: "not_found" }
  | ({ readonly kind: "withdrawn" } & WithdrawnAssetSummary)
  | { readonly kind: "found"; readonly asset: AssetDetailRecord };

const DETAIL_SELECT = {
  id: true,
  assetCode: true,
  qrToken: true,
  name: true,
  status: true,
  condition: true,
  brand: true,
  model: true,
  serialNumber: true,
  universityAssetCode: true,
  acquisitionYear: true,
  notes: true,
  purchasePrice: true,
  procurementDocNo: true,
  vendor: true,
  warrantyUntil: true,
  custodianName: true,
  custodianEmail: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  category: { select: { name: true, nameEn: true } },
  room: { select: { name: true, building: { select: { name: true } } } },
  fundingSource: { select: { name: true } },
  createdBy: { select: { name: true } },
} as const;

type DetailRow = NonNullable<Awaited<ReturnType<typeof selectAssetDetailRow>>>;

function selectAssetDetailRow(id: string) {
  return db.asset.findUnique({ where: { id }, select: DETAIL_SELECT });
}

async function toAssetDetailRecord(row: DetailRow): Promise<AssetDetailRecord> {
  const locale = await getLocale();
  return {
    id: row.id,
    assetCode: row.assetCode,
    qrToken: row.qrToken,
    name: row.name,
    categoryName: locale === "en" ? row.category.nameEn : row.category.name,
    status: row.status,
    condition: row.condition,
    roomName: row.room.name,
    buildingName: row.room.building.name,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serialNumber,
    universityAssetCode: row.universityAssetCode,
    acquisitionYear: row.acquisitionYear,
    notes: row.notes,
    purchasePrice: row.purchasePrice?.toFixed(PRICE_DECIMAL_PLACES) ?? null,
    fundingSourceName: row.fundingSource?.name ?? null,
    procurementDocNo: row.procurementDocNo,
    vendor: row.vendor,
    warrantyUntil: row.warrantyUntil,
    custodianName: row.custodianName,
    custodianEmail: row.custodianEmail,
    createdByName: row.createdBy.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * One asset for the detail page, or the reason it cannot be shown. A missing
 * row is `not_found` (a real `notFound()` on the page); a soft-deleted row is
 * `withdrawn` — a distinct, localised state, never a raw 404.
 */
export async function findAssetDetail(id: string): Promise<AssetDetailResult> {
  const row = await selectAssetDetailRow(id);
  if (!row) {
    return { kind: "not_found" };
  }
  if (row.deletedAt !== null) {
    return { kind: "withdrawn", assetCode: row.assetCode, name: row.name };
  }
  return { kind: "found", asset: await toAssetDetailRecord(row) };
}
