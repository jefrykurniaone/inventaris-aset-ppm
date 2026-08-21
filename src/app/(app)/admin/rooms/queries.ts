import { db } from "@/lib/db";

export interface RoomListRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly assetCount: number;
  readonly buildingId: string;
  readonly buildingCode: string;
  readonly buildingName: string;
}

/**
 * Lists rooms, optionally filtered to one building (PRD FR-3.3: "the room
 * list is filterable by building"), each with its live asset-reference
 * count (PRD FR-3.4). The render is allowed to go stale on that count —
 * `deleteRoom` (`mutations.ts`) re-checks atomically at delete time.
 */
export async function listRooms(
  buildingId?: string,
): Promise<readonly RoomListRow[]> {
  const rooms = await db.room.findMany({
    where: buildingId ? { buildingId } : undefined,
    orderBy: [{ building: { code: "asc" } }, { code: "asc" }],
    include: {
      building: { select: { code: true, name: true } },
      _count: { select: { assets: true } },
    },
  });

  return rooms.map((room) => ({
    id: room.id,
    code: room.code,
    name: room.name,
    isActive: room.isActive,
    assetCount: room._count.assets,
    buildingId: room.buildingId,
    buildingCode: room.building.code,
    buildingName: room.building.name,
  }));
}
