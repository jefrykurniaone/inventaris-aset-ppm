import {
  PRICE_DECIMAL_PLACES,
  type AssetCondition,
  type AssetStatus,
} from "@/app/(app)/assets/schemas";

/**
 * Turning the 60-item equipment catalog (`prisma/seed-data/asset-catalog.ts`)
 * into a full asset plan: acquisition year, status, condition, room, funding
 * source, price, and — for a chosen few — a loan role or a photo count.
 *
 * Pure and index-driven, on purpose. `prisma/seed-data/asset-writer.ts` is
 * the impure half that walks this plan and calls `createAsset`; everything
 * that decides *what* the sixtieth asset looks like lives here instead, where
 * `vitest.config.mts` actually instruments it (`prisma/**` is not part of
 * the test run).
 *
 * Every allocation is a deterministic function of the catalog index, not a
 * literal list of "asset #37 is retired" — so the mix survives a reordering
 * of the catalog files without anyone having to renumber anything by hand.
 */

export interface SeedCatalogItem {
  readonly categoryCode: string;
  readonly name: string;
  readonly brand: string | null;
  readonly model: string | null;
  /** Whole rupiah. Formatted to `assetSchema`'s two-decimal string by
   * `formatPurchasePrice` below, so the catalog files stay plain numbers. */
  readonly basePriceIdr: number;
}

/** The five roles the demonstration loans need (issue #16): one clearly
 * overdue, one due soon, two already returned, and one plain open loan so
 * the register is not only edge cases. */
export const SEED_LOAN_ROLES = [
  "overdue",
  "dueSoon",
  "returnedA",
  "returnedB",
  "plainActive",
] as const;

export type SeedLoanRole = (typeof SEED_LOAN_ROLES)[number];

export interface SeedAssetRefs {
  readonly categoryIdByCode: Readonly<Record<string, string>>;
  readonly roomIds: readonly string[];
  readonly fundingSourceIds: readonly string[];
}

export type SeedPhotoCount = 0 | 1 | 2;

export interface SeedAssetPlanItem {
  readonly seedKey: string;
  readonly name: string;
  readonly brand: string | null;
  readonly model: string | null;
  /** The catalog's own code (`LAB`, `IT`, …), kept alongside the resolved
   * `categoryId` so `prisma/seed-data/photo-writer.ts` can pick which
   * placeholder image variant belongs to this asset without a second lookup
   * back through `refs`. */
  readonly categoryCode: string;
  readonly categoryId: string;
  readonly roomId: string;
  readonly fundingSourceId: string;
  readonly acquisitionYear: number;
  readonly status: AssetStatus;
  readonly condition: AssetCondition;
  readonly purchasePrice: string;
  readonly loanRole: SeedLoanRole | null;
  readonly photoCount: SeedPhotoCount;
}

const SEED_KEY_DIGITS = 3;

/** The stable natural key an idempotent rerun looks the asset up by —
 * `Asset.universityAssetCode` is not used for anything else, so it is safe
 * to repurpose as this seed's marker. Insertion order plays no part in it. */
export function seedKeyFor(index: number): string {
  return `SEED-${String(index + 1).padStart(SEED_KEY_DIGITS, "0")}`;
}

const ACQUISITION_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

export function acquisitionYearFor(index: number): number {
  return ACQUISITION_YEARS[index % ACQUISITION_YEARS.length];
}

/** Exactly one `lost` asset (issue #16). */
const LOST_INDEX = 33;

/** A couple of `retired` assets. */
const RETIRED_INDICES: ReadonlySet<number> = new Set([7, 51]);

/** Several `in_repair` assets, spread evenly rather than listed by hand: one
 * every ten items, starting at index 4 — six across the sixty. */
const IN_REPAIR_STEP = 10;
const IN_REPAIR_OFFSET = 4;

function isInRepair(index: number): boolean {
  return (index - IN_REPAIR_OFFSET) % IN_REPAIR_STEP === 0;
}

/** The five assets a demonstration loan is written against. Chosen to avoid
 * every index above, so each starts `active` — the one status
 * `checkOutInTransaction` accepts (`CHECK_OUT_FROM_STATUS`). */
const LOAN_ROLE_BY_INDEX: Readonly<Record<number, SeedLoanRole>> = {
  0: "overdue",
  1: "dueSoon",
  2: "returnedA",
  3: "returnedB",
  55: "plainActive",
};

export function loanRoleFor(index: number): SeedLoanRole | null {
  return LOAN_ROLE_BY_INDEX[index] ?? null;
}

/**
 * Status follows a fixed priority — a lost item is never also reported
 * retired, and an in-repair item that happens to land on a loan-role index
 * cannot occur, because the two index sets are disjoint by construction. See
 * `seed-asset-mix.test.ts` for the assertion that they stay that way.
 */
export function statusFor(index: number): AssetStatus {
  if (index === LOST_INDEX) {
    return "lost";
  }
  if (RETIRED_INDICES.has(index)) {
    return "retired";
  }
  if (isInRepair(index)) {
    return "in_repair";
  }
  return "active";
}

/** `poor`: one every twelve items (five across sixty). `fair`: one every
 * four, offset so it never lands on a `poor` index — twelve is a multiple of
 * four, so the two remainders can never coincide. Everything else is
 * `good`, which is most of the register, as a real inventory's would be. */
const POOR_MODULUS = 12;
const POOR_OFFSET = 2;
const FAIR_MODULUS = 4;
const FAIR_OFFSET = 1;

export function conditionFor(index: number): AssetCondition {
  if ((index - POOR_OFFSET) % POOR_MODULUS === 0) {
    return "poor";
  }
  if ((index - FAIR_OFFSET) % FAIR_MODULUS === 0) {
    return "fair";
  }
  return "good";
}

/** Two photographed assets per category get one photo; one per category gets
 * two — five categories times three is the ~15 photographed assets issue #16
 * asks for, and five of them carry a second photo. */
const TWO_PHOTO_INDICES: ReadonlySet<number> = new Set([6, 18, 30, 42, 54]);
const ONE_PHOTO_INDICES: ReadonlySet<number> = new Set([
  9, 10, 14, 21, 26, 33, 38, 45, 50, 57,
]);

export function photoCountFor(index: number): SeedPhotoCount {
  if (TWO_PHOTO_INDICES.has(index)) {
    return 2;
  }
  if (ONE_PHOTO_INDICES.has(index)) {
    return 1;
  }
  return 0;
}

/** `assetSchema.purchasePrice` wants `"1234.00"`, not a number. The catalog
 * stores a plain integer so the data files stay easy to skim. */
function formatPurchasePrice(basePriceIdr: number): string {
  return basePriceIdr.toFixed(PRICE_DECIMAL_PLACES);
}

function buildPlanItem(
  item: SeedCatalogItem,
  index: number,
  refs: SeedAssetRefs,
): SeedAssetPlanItem {
  return {
    seedKey: seedKeyFor(index),
    name: item.name,
    brand: item.brand,
    model: item.model,
    categoryCode: item.categoryCode,
    categoryId: refs.categoryIdByCode[item.categoryCode],
    roomId: refs.roomIds[index % refs.roomIds.length],
    fundingSourceId:
      refs.fundingSourceIds[index % refs.fundingSourceIds.length],
    acquisitionYear: acquisitionYearFor(index),
    status: statusFor(index),
    condition: conditionFor(index),
    purchasePrice: formatPurchasePrice(item.basePriceIdr),
    loanRole: loanRoleFor(index),
    photoCount: photoCountFor(index),
  };
}

/** The full plan, one entry per catalog item, in catalog order. Catalog order
 * only decides which equipment gets which index — nothing here reads
 * anything about *previous* runs, which is what keeps this function pure. */
export function buildAssetPlan(
  catalog: readonly SeedCatalogItem[],
  refs: SeedAssetRefs,
): readonly SeedAssetPlanItem[] {
  return catalog.map((item, index) => buildPlanItem(item, index, refs));
}
