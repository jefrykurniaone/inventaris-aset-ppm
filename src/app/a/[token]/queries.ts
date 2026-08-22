import { getLocale } from "next-intl/server";

import {
  ANONYMOUS_ASSET_SCAN_SELECT,
  SIGNED_IN_ASSET_SCAN_SELECT,
  type ScanAudience,
} from "@/lib/asset-visibility";
import { db } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";

import {
  PRICE_DECIMAL_PLACES,
  type AssetCondition,
  type AssetStatus,
} from "@/app/(app)/assets/schemas";

/**
 * The read for the public scan page (issue #11, PRD FR-6.1 to FR-6.3).
 *
 * The audience picks the *query*, not the rendering: `selectAnonymousRow` and
 * `selectSignedInRow` are two separate calls precisely so the anonymous one
 * can be proved, by reading `src/lib/asset-visibility.ts` and its test, never
 * to have named a restricted column. Nothing downstream of here can undo that,
 * which is the point.
 *
 * `@/app/(app)/assets/schemas` is imported for two types and one constant.
 * That module sits under the `(app)` route group but is a plain Zod/constants
 * file — it imports `zod` and nothing else, no `next/headers`, no `@/lib/auth`,
 * no `@/lib/db` — so importing it here drags no session-only code onto a
 * public route. A route group is a URL-organisation device, not a boundary;
 * `(app)/layout.tsx` is the boundary, and this page is not under it.
 */

export interface ScanPhoto {
  readonly id: string;
  readonly url: string;
  readonly thumbnailUrl: string;
  readonly width: number;
  readonly height: number;
}

/** Who is holding the item — restricted, so `null` for an anonymous visitor
 * whatever the loan state (FR-6.2: only "on loan, due <date>" is public). */
export interface ScanLoanBorrower {
  readonly name: string;
  readonly email: string;
  readonly unit: string;
  readonly handledByName: string;
  readonly checkedOutAt: Date;
}

export interface ScanOpenLoan {
  readonly dueAt: Date;
  readonly borrower: ScanLoanBorrower | null;
}

/** The RESTRICTED half of §8.2, present only when a session was found. */
export interface ScanRestrictedRecord {
  readonly assetId: string;
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

export interface ScanAssetRecord {
  readonly assetCode: string;
  readonly name: string;
  readonly categoryName: string;
  readonly status: AssetStatus;
  readonly condition: AssetCondition;
  readonly buildingName: string;
  readonly roomName: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly universityAssetCode: string | null;
  readonly acquisitionYear: number;
  readonly notes: string | null;
  readonly qrToken: string;
  readonly photos: readonly ScanPhoto[];
  readonly openLoan: ScanOpenLoan | null;
  readonly restricted: ScanRestrictedRecord | null;
}

/** A withdrawn record still names itself, so a scanned label is never a dead
 * end (FR-2.5). Both values are PUBLIC in §8.2, and the asset code is printed
 * on the label the visitor is already holding. */
export interface WithdrawnScanSummary {
  readonly assetCode: string;
  readonly name: string;
}

export type ScanResult =
  | { readonly kind: "not_found" }
  | ({ readonly kind: "withdrawn" } & WithdrawnScanSummary)
  | { readonly kind: "found"; readonly asset: ScanAssetRecord };

function selectAnonymousRow(qrToken: string) {
  return db.asset.findUnique({
    where: { qrToken },
    select: ANONYMOUS_ASSET_SCAN_SELECT,
  });
}

function selectSignedInRow(qrToken: string) {
  return db.asset.findUnique({
    where: { qrToken },
    select: SIGNED_IN_ASSET_SCAN_SELECT,
  });
}

type SignedInRow = NonNullable<Awaited<ReturnType<typeof selectSignedInRow>>>;
type AnonymousRow = NonNullable<Awaited<ReturnType<typeof selectAnonymousRow>>>;
type ScanRow = AnonymousRow | SignedInRow;

/** Narrows on a column the anonymous selection does not name, so the guard
 * cannot silently start passing if the two selections ever converge. */
function isSignedInRow(row: ScanRow): row is SignedInRow {
  return "createdBy" in row;
}

type OpenLoanRow = ScanRow["loans"][number];

function toBorrower(loan: OpenLoanRow): ScanLoanBorrower | null {
  if (!("borrowerName" in loan)) {
    return null;
  }
  return {
    name: loan.borrowerName,
    email: loan.borrowerEmail,
    unit: loan.borrowerUnit,
    handledByName: loan.handledBy.name,
    checkedOutAt: loan.checkedOutAt,
  };
}

function toOpenLoan(row: ScanRow): ScanOpenLoan | null {
  const [loan] = row.loans;
  if (!loan) {
    return null;
  }
  return { dueAt: loan.dueAt, borrower: toBorrower(loan) };
}

function toRestricted(row: SignedInRow): ScanRestrictedRecord {
  return {
    assetId: row.id,
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

/** Object paths become URLs here, at read time, through the storage seam
 * (FR-4.9) — the database never holds a URL. */
function toPhotos(row: ScanRow): readonly ScanPhoto[] {
  const storage = getObjectStorage();
  return row.photos.map((photo) => ({
    id: photo.id,
    url: storage.getPublicUrl(photo.objectPath),
    thumbnailUrl: storage.getPublicUrl(photo.thumbObjectPath),
    width: photo.width,
    height: photo.height,
  }));
}

async function toScanAssetRecord(row: ScanRow): Promise<ScanAssetRecord> {
  const locale = await getLocale();
  return {
    assetCode: row.assetCode,
    name: row.name,
    categoryName: locale === "en" ? row.category.nameEn : row.category.name,
    status: row.status,
    condition: row.condition,
    buildingName: row.room.building.name,
    roomName: row.room.name,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serialNumber,
    universityAssetCode: row.universityAssetCode,
    acquisitionYear: row.acquisitionYear,
    notes: row.notes,
    qrToken: row.qrToken,
    photos: toPhotos(row),
    openLoan: toOpenLoan(row),
    restricted: isSignedInRow(row) ? toRestricted(row) : null,
  };
}

/**
 * One asset by its `qrToken`, or the reason it cannot be shown.
 *
 * A token that matches nothing is `not_found`, and the page turns that into a
 * plain localised 404 that says the same thing for a token that never existed
 * and for one that was mistyped — an anonymous caller learns nothing about the
 * register either way. A soft-deleted row is `withdrawn`, a distinct state
 * rather than a 404 (FR-2.5).
 */
export async function findAssetByQrToken(
  qrToken: string,
  audience: ScanAudience,
): Promise<ScanResult> {
  const row: ScanRow | null =
    audience === "signedIn"
      ? await selectSignedInRow(qrToken)
      : await selectAnonymousRow(qrToken);

  if (!row) {
    return { kind: "not_found" };
  }
  if (row.deletedAt !== null) {
    return { kind: "withdrawn", assetCode: row.assetCode, name: row.name };
  }
  return { kind: "found", asset: await toScanAssetRecord(row) };
}
