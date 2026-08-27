import { db } from "@/lib/db";
import {
  buildRoomListOrderBy,
  type MasterDataListParams,
  type MasterDataSortKey,
} from "@/lib/master-data-list-query";
import { buildTablePageWindow } from "@/lib/table-sort";

export interface RoomListRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly assetCount: number;
  readonly buildingId: string;
  readonly buildingCode: string;
  readonly buildingName: string;
  readonly createdAt: Date;
}

export interface RoomListPage {
  readonly rows: readonly RoomListRow[];
  readonly totalCount: number;
}

/**
 * One page of rooms, optionally filtered to one building (PRD FR-3.3: "the
 * room list is filterable by building"), each with its live asset-reference
 * count (PRD FR-3.4). The render is allowed to go stale on that count —
 * `deleteRoom` (`mutations.ts`) re-checks atomically at delete time.
 *
 * Sorted and paginated at the database since issue #87. Ordering by code
 * orders by building first: `Room.code` is unique only within its building,
 * so room code alone interleaves two buildings' rooms.
 */
export async function listRooms(
  params: MasterDataListParams<MasterDataSortKey>,
  buildingId?: string,
): Promise<RoomListPage> {
  const where = buildingId ? { buildingId } : undefined;
  const { skip, take } = buildTablePageWindow(params.page, params.pageSize);

  const [rooms, totalCount] = await Promise.all([
    db.room.findMany({
      where,
      orderBy: buildRoomListOrderBy(params.sort, params.dir),
      skip,
      take,
      include: {
        building: { select: { code: true, name: true } },
        _count: { select: { assets: true } },
      },
    }),
    db.room.count({ where }),
  ]);

  return {
    rows: rooms.map((room) => ({
      id: room.id,
      code: room.code,
      name: room.name,
      isActive: room.isActive,
      assetCount: room._count.assets,
      buildingId: room.buildingId,
      buildingCode: room.building.code,
      buildingName: room.building.name,
      createdAt: room.createdAt,
    })),
    totalCount,
  };
}
