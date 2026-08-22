import type { db as Database } from "@/lib/db";
import type { SeedAssetRefs } from "@/lib/seed-asset-mix";

import { SEED_BUILDINGS } from "./buildings";
import { SEED_CATEGORIES } from "./categories";
import { SEED_FUNDING_SOURCES } from "./funding-sources";

/**
 * Idempotent master data for the demonstration dataset (issue #16): the five
 * categories, three buildings with their rooms, and four funding sources.
 *
 * Same pattern as `scripts/seed-e2e-master-data.ts`: keyed on each row's own
 * unique column, never on row count, so this coexists with whatever a
 * developer's database already holds — that script's own `ETE` fixtures
 * included. An existing row is left untouched and reported as such.
 */

type Db = typeof Database;

export interface SeedMasterDataResult {
  readonly refs: SeedAssetRefs;
  readonly messages: readonly string[];
}

async function ensureCategory(
  db: Db,
  spec: {
    readonly code: string;
    readonly name: string;
    readonly nameEn: string;
  },
): Promise<{ readonly id: string; readonly message: string }> {
  const existing = await db.category.findUnique({
    where: { code: spec.code },
    select: { id: true },
  });
  if (existing) {
    return {
      id: existing.id,
      message: `category "${spec.code}" already exists; nothing changed.`,
    };
  }
  const created = await db.category.create({
    data: { code: spec.code, name: spec.name, nameEn: spec.nameEn },
    select: { id: true },
  });
  return { id: created.id, message: `created category "${spec.code}".` };
}

async function ensureBuilding(
  db: Db,
  spec: { readonly code: string; readonly name: string },
): Promise<{ readonly id: string; readonly message: string }> {
  const existing = await db.building.findUnique({
    where: { code: spec.code },
    select: { id: true },
  });
  if (existing) {
    return {
      id: existing.id,
      message: `building "${spec.code}" already exists; nothing changed.`,
    };
  }
  const created = await db.building.create({
    data: { code: spec.code, name: spec.name },
    select: { id: true },
  });
  return { id: created.id, message: `created building "${spec.code}".` };
}

async function ensureRoom(
  db: Db,
  buildingId: string,
  spec: { readonly code: string; readonly name: string },
): Promise<{ readonly id: string; readonly message: string }> {
  const existing = await db.room.findUnique({
    where: { buildingId_code: { buildingId, code: spec.code } },
    select: { id: true },
  });
  if (existing) {
    return {
      id: existing.id,
      message: `room "${spec.code}" already exists; nothing changed.`,
    };
  }
  const created = await db.room.create({
    data: { buildingId, code: spec.code, name: spec.name },
    select: { id: true },
  });
  return { id: created.id, message: `created room "${spec.code}".` };
}

async function ensureFundingSource(
  db: Db,
  spec: { readonly name: string; readonly notes: string | null },
): Promise<{ readonly id: string; readonly message: string }> {
  const existing = await db.fundingSource.findUnique({
    where: { name: spec.name },
    select: { id: true },
  });
  if (existing) {
    return {
      id: existing.id,
      message: `funding source "${spec.name}" already exists; nothing changed.`,
    };
  }
  const created = await db.fundingSource.create({
    data: { name: spec.name, notes: spec.notes },
    select: { id: true },
  });
  return {
    id: created.id,
    message: `created funding source "${spec.name}".`,
  };
}

async function seedCategories(db: Db): Promise<{
  readonly byCode: Record<string, string>;
  readonly messages: string[];
}> {
  const byCode: Record<string, string> = {};
  const messages: string[] = [];
  for (const spec of SEED_CATEGORIES) {
    const result = await ensureCategory(db, spec);
    byCode[spec.code] = result.id;
    messages.push(result.message);
  }
  return { byCode, messages };
}

async function seedRoomsOfBuilding(
  db: Db,
  building: (typeof SEED_BUILDINGS)[number],
): Promise<{ readonly roomIds: string[]; readonly messages: string[] }> {
  const buildingResult = await ensureBuilding(db, building);
  const roomIds: string[] = [];
  const messages = [buildingResult.message];
  for (const room of building.rooms) {
    const result = await ensureRoom(db, buildingResult.id, room);
    roomIds.push(result.id);
    messages.push(result.message);
  }
  return { roomIds, messages };
}

async function seedBuildingsAndRooms(
  db: Db,
): Promise<{ readonly roomIds: string[]; readonly messages: string[] }> {
  const roomIds: string[] = [];
  const messages: string[] = [];
  for (const building of SEED_BUILDINGS) {
    const result = await seedRoomsOfBuilding(db, building);
    roomIds.push(...result.roomIds);
    messages.push(...result.messages);
  }
  return { roomIds, messages };
}

async function seedFundingSources(
  db: Db,
): Promise<{ readonly ids: string[]; readonly messages: string[] }> {
  const ids: string[] = [];
  const messages: string[] = [];
  for (const spec of SEED_FUNDING_SOURCES) {
    const result = await ensureFundingSource(db, spec);
    ids.push(result.id);
    messages.push(result.message);
  }
  return { ids, messages };
}

/** Seeds every master-data row the demonstration dataset needs, returning
 * the ids `seed-asset-mix.ts`'s `buildAssetPlan` resolves against. */
export async function seedMasterData(db: Db): Promise<SeedMasterDataResult> {
  const categories = await seedCategories(db);
  const buildings = await seedBuildingsAndRooms(db);
  const fundingSources = await seedFundingSources(db);

  return {
    refs: {
      categoryIdByCode: categories.byCode,
      roomIds: buildings.roomIds,
      fundingSourceIds: fundingSources.ids,
    },
    messages: [
      ...categories.messages,
      ...buildings.messages,
      ...fundingSources.messages,
    ],
  };
}
