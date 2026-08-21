import { getTranslations } from "next-intl/server";

import { listActiveBuildingOptions } from "@/app/(app)/admin/buildings/queries";
import { requireAdmin } from "@/lib/require-user";

import { createRoomAction } from "./actions";
import { listRooms } from "./queries";
import { RoomBuildingFilter } from "./RoomBuildingFilter";
import { RoomForm } from "./RoomForm";
import { roomBuildingFilterSchema } from "./schemas";
import { RoomTable } from "./RoomTable";

interface AdminRoomsPageProps {
  readonly searchParams: Promise<{ readonly buildingId?: string }>;
}

/**
 * Admin-only room management (PRD FR-3.1, FR-3.3): list — filterable by
 * building — create, edit (via `[id]/page.tsx`) and deactivate.
 */
export default async function AdminRoomsPage({
  searchParams,
}: Readonly<AdminRoomsPageProps>) {
  await requireAdmin();
  const t = await getTranslations("AdminRoomsPage");
  const { buildingId: rawBuildingId } = await searchParams;
  const buildingId = roomBuildingFilterSchema.parse(rawBuildingId);

  const [rooms, buildingOptions] = await Promise.all([
    listRooms(buildingId),
    listActiveBuildingOptions(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <RoomForm
        action={createRoomAction}
        heading={t("createHeading")}
        submitLabel={t("createSubmit")}
        submitPendingLabel={t("createSubmitPending")}
        buildingOptions={buildingOptions}
        buildingLabel={t("buildingLabel")}
        buildingPlaceholder={t("buildingPlaceholder")}
        codeLabel={t("codeLabel")}
        nameLabel={t("nameLabel")}
      />
      <RoomBuildingFilter
        buildingOptions={buildingOptions}
        selectedBuildingId={buildingId}
        t={t}
      />
      <RoomTable
        rooms={rooms}
        t={t}
        emptyStateKey={buildingId ? "emptyStateFiltered" : "emptyState"}
      />
    </div>
  );
}
