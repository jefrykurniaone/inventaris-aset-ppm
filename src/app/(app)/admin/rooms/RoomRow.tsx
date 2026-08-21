import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DeleteControl } from "@/components/DeleteControl";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/button";

import {
  deactivateRoomAction,
  deleteRoomAction,
  reactivateRoomAction,
} from "./actions";
import type { RoomListRow } from "./queries";

type AdminRoomsT = Awaited<
  ReturnType<typeof getTranslations<"AdminRoomsPage">>
>;

interface RoomRowProps {
  readonly room: RoomListRow;
  readonly t: AdminRoomsT;
}

/** The deactivate/reactivate toggle — reversible, so no confirmation step. */
function ActiveToggle({ room, t }: Readonly<RoomRowProps>) {
  const action = room.isActive ? deactivateRoomAction : reactivateRoomAction;
  const idleLabel = room.isActive ? t("deactivate") : t("reactivate");
  const pendingLabel = room.isActive
    ? t("deactivatePending")
    : t("reactivatePending");

  return (
    <form action={action}>
      <input type="hidden" name="id" value={room.id} />
      <SubmitButton
        variant="outline"
        idleLabel={idleLabel}
        pendingLabel={pendingLabel}
      />
    </form>
  );
}

/** Delete is only offered when no asset sits in this room yet (PRD FR-3.4);
 * `deleteRoomAction` re-checks that atomically regardless. */
function DeleteOrReferencedNote({ room, t }: Readonly<RoomRowProps>) {
  if (room.assetCount > 0) {
    return (
      <span className="text-muted-foreground text-sm">
        {t("referencedByAssets", { count: room.assetCount })}
      </span>
    );
  }

  return (
    <DeleteControl
      action={deleteRoomAction}
      id={room.id}
      triggerLabel={t("delete")}
      pendingLabel={t("deletePending")}
      title={t("deleteConfirmTitle", { code: room.code })}
      description={t("deleteConfirmDescription")}
      cancelLabel={t("cancel")}
      confirmLabel={t("deleteConfirm")}
    />
  );
}

/** One row of the room list, split out of `RoomTable` to keep every
 * function in this feature under the project's 40-line limit. */
export function RoomRow({ room, t }: Readonly<RoomRowProps>) {
  return (
    <tr className="border-border border-b align-top">
      <td className="py-2 pr-4">{`${room.buildingCode} — ${room.buildingName}`}</td>
      <td className="py-2 pr-4 font-mono">{room.code}</td>
      <td className="py-2 pr-4">{room.name}</td>
      <td className="py-2 pr-4">
        {room.isActive ? t("statusActive") : t("statusDeactivated")}
      </td>
      <td className="py-2 pr-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/rooms/${room.id}`}>{t("edit")}</Link>
        </Button>
      </td>
      <td className="py-2 pr-4">
        <ActiveToggle room={room} t={t} />
      </td>
      <td className="py-2">
        <DeleteOrReferencedNote room={room} t={t} />
      </td>
    </tr>
  );
}
