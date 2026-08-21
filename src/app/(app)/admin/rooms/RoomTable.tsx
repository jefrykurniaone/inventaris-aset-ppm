import { getTranslations } from "next-intl/server";

import { RoomRow } from "./RoomRow";
import type { RoomListRow } from "./queries";

type AdminRoomsT = Awaited<
  ReturnType<typeof getTranslations<"AdminRoomsPage">>
>;

interface RoomTableProps {
  readonly rooms: readonly RoomListRow[];
  readonly t: AdminRoomsT;
  readonly emptyStateKey: "emptyState" | "emptyStateFiltered";
}

const COLUMN_KEYS = [
  "columnBuilding",
  "columnCode",
  "columnName",
  "columnStatus",
  "columnEdit",
  "columnActive",
  "columnDelete",
] as const;

/** The room list itself (PRD FR-3.1, FR-3.3), split out of
 * `AdminRoomsPage` so that function stays under the 40-line limit. */
export function RoomTable({
  rooms,
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
            {COLUMN_KEYS.map((key) => (
              <th key={key} scope="col" className="py-2 pr-4 font-medium">
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <RoomRow key={room.id} room={room} t={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
