import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { listActiveBuildingOptions } from "@/app/(app)/admin/buildings/queries";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-user";

import { updateRoomAction } from "../actions";
import { RoomForm } from "../RoomForm";

interface EditRoomPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/** Room edit page (PRD FR-3.1, FR-3.3). */
export default async function EditRoomPage({
  params,
}: Readonly<EditRoomPageProps>) {
  await requireAdmin();
  const { id } = await params;
  const t = await getTranslations("AdminRoomsPage");

  const [room, buildingOptions] = await Promise.all([
    db.room.findUnique({ where: { id } }),
    listActiveBuildingOptions(),
  ]);
  if (!room) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/rooms"
        className="text-primary text-sm hover:underline"
      >
        {t("backToList")}
      </Link>
      <RoomForm
        action={updateRoomAction}
        heading={t("editHeading")}
        submitLabel={t("editSubmit")}
        submitPendingLabel={t("editSubmitPending")}
        buildingOptions={buildingOptions}
        buildingLabel={t("buildingLabel")}
        buildingPlaceholder={t("buildingPlaceholder")}
        codeLabel={t("codeLabel")}
        nameLabel={t("nameLabel")}
        id={room.id}
        defaultBuildingId={room.buildingId}
        defaultCode={room.code}
        defaultName={room.name}
      />
    </div>
  );
}
