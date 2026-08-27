import { db } from "@/lib/db";
import {
  buildMasterDataOrderBy,
  type MasterDataListParams,
  type MasterDataSortKey,
} from "@/lib/master-data-list-query";
import { buildTablePageWindow } from "@/lib/table-sort";

export interface BuildingListRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly roomCount: number;
  readonly createdAt: Date;
}

export interface BuildingListPage {
  readonly rows: readonly BuildingListRow[];
  readonly totalCount: number;
}

/**
 * One page of buildings, each with its live room count. `Room.buildingId` is
 * `onDelete: Restrict`, so this count — not a count of assets — is what
 * actually decides whether a delete would be refused at the database (PRD
 * FR-3.3, FR-3.4); the render is allowed to go stale on it since
 * `deleteBuilding` re-checks atomically at delete time.
 *
 * Sorted and paginated at the database since issue #87: `orderBy`, `skip` and
 * `take` all come from the pure translation in
 * `@/lib/master-data-list-query`, so there is a query to check rather than a
 * rendered table to eyeball.
 */
export async function listBuildings(
  params: MasterDataListParams<MasterDataSortKey>,
): Promise<BuildingListPage> {
  const { skip, take } = buildTablePageWindow(params.page, params.pageSize);

  const [buildings, totalCount] = await Promise.all([
    db.building.findMany({
      orderBy: buildMasterDataOrderBy(params.sort, params.dir),
      skip,
      take,
      include: { _count: { select: { rooms: true } } },
    }),
    db.building.count(),
  ]);

  return {
    rows: buildings.map((building) => ({
      id: building.id,
      code: building.code,
      name: building.name,
      isActive: building.isActive,
      roomCount: building._count.rooms,
      createdAt: building.createdAt,
    })),
    totalCount,
  };
}

/** All active buildings, for the room create/edit forms' picker (PRD
 * FR-3.3: "Rooms belong to a building"). Unpaginated on purpose: it feeds a
 * `<select>`, not a table. */
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
