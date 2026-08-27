import { getTranslations } from "next-intl/server";

import type { TableColumnSpec } from "@/components/table-columns";
import { TableHeaderCells } from "@/components/TableHeaderCells";
import type { Locale } from "@/i18n/config";
import {
  DEFAULT_MASTER_DATA_SORT_KEY,
  withMasterDataSort,
  type MasterDataListParams,
  type MasterDataSortKey,
} from "@/lib/master-data-list-query";
import { ADMIN_ROOMS_PATH } from "@/lib/paths";

import { RoomRow } from "./RoomRow";
import type { RoomListRow } from "./queries";

type AdminRoomsT = Awaited<
  ReturnType<typeof getTranslations<"AdminRoomsPage">>
>;

type AdminRoomsMessageKey = Parameters<AdminRoomsT>[0];

interface RoomTableProps {
  readonly rooms: readonly RoomListRow[];
  readonly params: MasterDataListParams<MasterDataSortKey>;
  /** The building filter, carried into every header link so reordering keeps
   * the filter. Empty when no building is selected. */
  readonly base: URLSearchParams;
  readonly locale: Locale;
  readonly t: AdminRoomsT;
  readonly emptyStateKey: "emptyState" | "emptyStateFiltered";
}

interface RoomColumn {
  readonly id: string;
  readonly labelKey: AdminRoomsMessageKey;
  readonly sortKey?: MasterDataSortKey;
}

/** The curated sortable set (issue #87): room code — which orders by
 * building first, since a room code repeats between buildings — name and
 * creation time. The building column is that same `code` order under another
 * heading, so it carries no separate sort of its own. */
const ROOM_COLUMNS: readonly RoomColumn[] = [
  { id: "building", labelKey: "columnBuilding" },
  { id: "code", labelKey: "columnCode", sortKey: "code" },
  { id: "name", labelKey: "columnName", sortKey: "name" },
  { id: "status", labelKey: "columnStatus" },
  { id: "createdAt", labelKey: "columnCreatedAt", sortKey: "createdAt" },
  { id: "edit", labelKey: "columnEdit" },
  { id: "active", labelKey: "columnActive" },
  { id: "delete", labelKey: "columnDelete" },
];

function toColumnSpecs(
  t: AdminRoomsT,
): readonly TableColumnSpec<MasterDataSortKey>[] {
  return ROOM_COLUMNS.map((column) => ({
    id: column.id,
    label: t(column.labelKey),
    sortKey: column.sortKey,
    initialDirection: column.sortKey === "createdAt" ? "desc" : "asc",
  }));
}

/** The room list itself (PRD FR-3.1, FR-3.3), split out of
 * `AdminRoomsPage` so that function stays under the 40-line limit. */
export function RoomTable({
  rooms,
  params,
  base,
  locale,
  t,
  emptyStateKey,
}: Readonly<RoomTableProps>) {
  if (rooms.length === 0) {
    return <p className="text-muted-foreground text-sm">{t(emptyStateKey)}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            <TableHeaderCells
              action={ADMIN_ROOMS_PATH}
              columns={toColumnSpecs(t)}
              sortKey={params.sort}
              direction={params.dir}
              paramsFor={(sortKey, direction) =>
                withMasterDataSort(
                  base,
                  params,
                  DEFAULT_MASTER_DATA_SORT_KEY,
                  sortKey,
                  direction,
                )
              }
            />
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <RoomRow key={room.id} room={room} locale={locale} t={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
