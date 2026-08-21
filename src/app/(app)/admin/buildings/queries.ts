import { db } from "@/lib/db";

export interface BuildingListRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly roomCount: number;
}

/**
 * Lists every building with its live room count. `Room.buildingId` is
 * `onDelete: Restrict`, so this count — not a count of assets — is what
 * actually decides whether a delete would be refused at the database (PRD
 * FR-3.3, FR-3.4); the render is allowed to go stale on it since
 * `deleteBuilding` re-checks atomically at delete time.
 */
export async function listBuildings(): Promise<readonly BuildingListRow[]> {
  const buildings = await db.building.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { rooms: true } } },
  });

  return buildings.map((building) => ({
    id: building.id,
    code: building.code,
    name: building.name,
    isActive: building.isActive,
    roomCount: building._count.rooms,
  }));
}

/** All active buildings, for the room create/edit forms' picker (PRD
 * FR-3.3: "Rooms belong to a building"). */
export async function listActiveBuildingOptions(): Promise<
  ReadonlyArray<{
    readonly id: string;
    readonly code: string;
    readonly name: string;
  }>
> {
  return db.building.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}
