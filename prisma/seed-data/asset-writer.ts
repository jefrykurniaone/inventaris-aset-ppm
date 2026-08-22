import { createAsset } from "@/app/(app)/assets/mutations";
import { db } from "@/lib/db";
import {
  buildAssetPlan,
  type SeedAssetPlanItem,
  type SeedAssetRefs,
} from "@/lib/seed-asset-mix";

import { ASSET_CATALOG } from "./asset-catalog";

/**
 * Writing the sixty demonstration assets through the real mutation (issue
 * #16), never by hand-minting an `assetCode` or a `qrToken` — `createAsset`
 * in `src/app/(app)/assets/mutations.ts` is the only place either is issued.
 *
 * Idempotency is keyed on `Asset.universityAssetCode`, set to each item's
 * `seedKey` from `seed-asset-mix.ts` — a stable natural key, not the
 * `assetCode` the mutation assigns, which depends on how many rows already
 * exist in that (category, year) namespace and is therefore *not* stable
 * across a rerun that also has to coexist with a developer's own data.
 */

export interface SeedAssetWriteResult {
  readonly assetIdBySeedKey: ReadonlyMap<string, string>;
  readonly planBySeedKey: ReadonlyMap<string, SeedAssetPlanItem>;
  readonly messages: readonly string[];
}

async function ensureAsset(
  item: SeedAssetPlanItem,
  actorId: string,
): Promise<{ readonly id: string; readonly message: string }> {
  const existing = await db.asset.findFirst({
    where: { universityAssetCode: item.seedKey },
    select: { id: true },
  });
  if (existing) {
    return {
      id: existing.id,
      message: `asset "${item.seedKey}" (${item.name}) already exists; nothing changed.`,
    };
  }

  const result = await createAsset(
    {
      name: item.name,
      categoryId: item.categoryId,
      roomId: item.roomId,
      condition: item.condition,
      status: item.status,
      acquisitionYear: item.acquisitionYear,
      brand: item.brand,
      model: item.model,
      serialNumber: null,
      universityAssetCode: item.seedKey,
      notes: null,
      purchasePrice: item.purchasePrice,
      fundingSourceId: item.fundingSourceId,
      procurementDocNo: null,
      vendor: null,
      warrantyUntil: null,
      custodianName: null,
      custodianEmail: null,
    },
    actorId,
  );
  if (!result.ok) {
    throw new Error(
      `prisma/seed-data/asset-writer: could not create "${item.seedKey}" (${item.name}): ${result.reason}.`,
    );
  }
  return {
    id: result.assetId,
    message: `created asset "${result.assetCode}" (${item.name}).`,
  };
}

/** Seeds every asset in the plan, returning the id and plan item for each
 * `seedKey` so `loan-writer.ts` and `photo-writer.ts` can find the specific
 * assets they need without recomputing the plan or re-reading the database. */
export async function seedAssets(
  refs: SeedAssetRefs,
  actorId: string,
): Promise<SeedAssetWriteResult> {
  const plan = buildAssetPlan(ASSET_CATALOG, refs);
  const assetIdBySeedKey = new Map<string, string>();
  const planBySeedKey = new Map<string, SeedAssetPlanItem>();
  const messages: string[] = [];

  for (const item of plan) {
    const result = await ensureAsset(item, actorId);
    assetIdBySeedKey.set(item.seedKey, result.id);
    planBySeedKey.set(item.seedKey, item);
    messages.push(result.message);
  }

  return { assetIdBySeedKey, planBySeedKey, messages };
}
