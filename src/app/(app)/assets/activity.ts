import {
  ASSET_FIELD_NAMES,
  PRICE_DECIMAL_PLACES,
  type AssetFieldName,
  type AssetInput,
} from "./schemas";

/**
 * What goes into an `AssetActivity.payload` (PRD FR-8.3), and how a
 * submission is compared against the row it is about to overwrite.
 *
 * The audit trail records *which fields changed*, not a copy of the row: a
 * full row dump on every edit makes the trail unreadable, duplicates the
 * restricted half of §8.2 into a second table, and still does not answer the
 * only question the trail is read for — what did this person actually change.
 *
 * Pure, and free of any database import, so the diff rules are unit-testable
 * on their own (`activity.test.ts`).
 */

/** Every value a payload carries is a JSON scalar: `Date` and `Decimal` are
 * normalised on the way in, so a payload round-trips through `Json` without
 * `Date` becoming a string only on the second read. */
export type ActivityValue = string | number | null;

/**
 * A type alias rather than an `interface` on purpose: an `AssetChanges` map
 * is written straight into a Prisma `Json` column, and TypeScript grants an
 * implicit index signature — which `Prisma.InputJsonObject` requires — to
 * object *type aliases* but never to interfaces. Declaring this as an
 * interface compiles everywhere except at the one `assetActivity.create`
 * call that matters.
 */
export type AssetFieldChange = {
  readonly from: ActivityValue;
  readonly to: ActivityValue;
};

export type AssetChanges = Partial<Record<AssetFieldName, AssetFieldChange>>;

export type ComparableAsset = Record<AssetFieldName, ActivityValue>;

/**
 * The stored columns this module compares against, declared structurally
 * rather than imported from `@/generated/prisma`: `src/lib/db.ts` is the only
 * module allowed that import. Prisma's `Decimal` satisfies the
 * `purchasePrice` shape below by structure, so the seam holds without giving
 * up type safety.
 */
export interface StoredAssetFields {
  readonly name: string;
  readonly categoryId: string;
  readonly roomId: string;
  readonly condition: string;
  readonly status: string;
  readonly acquisitionYear: number;
  readonly brand: string | null;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly universityAssetCode: string | null;
  readonly notes: string | null;
  readonly purchasePrice: { toFixed(decimalPlaces: number): string } | null;
  readonly fundingSourceId: string | null;
  readonly procurementDocNo: string | null;
  readonly vendor: string | null;
  readonly warrantyUntil: Date | null;
  readonly custodianName: string | null;
  readonly custodianEmail: string | null;
}

function isDecimalLike(
  value: object,
): value is { toFixed(decimalPlaces: number): string } {
  return (
    "toFixed" in value &&
    typeof (value as { toFixed: unknown }).toFixed === "function"
  );
}

/** Normalises one stored or submitted value to a JSON scalar. `Decimal` goes
 * through `toFixed(2)` and `Date` through `toISOString()` so that the two
 * sides of a diff are comparable with `!==` — an object identity comparison
 * would report every unchanged price and warranty date as an edit. */
function toActivityValue(value: unknown): ActivityValue {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value !== null && isDecimalLike(value)) {
    return value.toFixed(PRICE_DECIMAL_PLACES);
  }
  return null;
}

/** Projects a submission or a stored row onto the same comparable shape. */
export function toComparableAsset(
  source: AssetInput | StoredAssetFields,
): ComparableAsset {
  const comparable = {} as Record<AssetFieldName, ActivityValue>;
  for (const field of ASSET_FIELD_NAMES) {
    comparable[field] = toActivityValue(source[field]);
  }
  return comparable;
}

/** The fields that actually differ, each with its before and after value. */
export function diffAssets(
  before: ComparableAsset,
  after: ComparableAsset,
): AssetChanges {
  const changes: AssetChanges = {};
  for (const field of ASSET_FIELD_NAMES) {
    if (before[field] !== after[field]) {
      changes[field] = { from: before[field], to: after[field] };
    }
  }
  return changes;
}

export function hasChanges(changes: AssetChanges): boolean {
  return Object.keys(changes).length > 0;
}

export interface SplitAssetChanges {
  readonly statusChange: AssetFieldChange | null;
  readonly otherChanges: AssetChanges;
}

/**
 * Separates the status transition from everything else in the same
 * submission. A status change is its own `status_changed` activity rather
 * than a line inside an `updated` payload, because the timeline (#10), the
 * loan register (#15) and the dashboard all read status history and none of
 * them should have to open an `updated` payload to find it. Any other field
 * edited in the same submission still gets its `updated` row, so no change is
 * lost by the split.
 */
export function splitStatusChange(changes: AssetChanges): SplitAssetChanges {
  const { status, ...otherChanges } = changes;
  return { statusChange: status ?? null, otherChanges };
}
