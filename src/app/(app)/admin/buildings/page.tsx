import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/require-user";

import { createBuildingAction } from "./actions";
import { BuildingForm } from "./BuildingForm";
import { BuildingTable } from "./BuildingTable";
import { listBuildings } from "./queries";

/**
 * Admin-only building management (PRD FR-3.1, FR-3.3): list, create, edit
 * (via `[id]/page.tsx`) and deactivate.
 */
export default async function AdminBuildingsPage() {
  await requireAdmin();
  const t = await getTranslations("AdminBuildingsPage");
  const buildings = await listBuildings();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <BuildingForm
        action={createBuildingAction}
        heading={t("createHeading")}
        submitLabel={t("createSubmit")}
        submitPendingLabel={t("createSubmitPending")}
        codeLabel={t("codeLabel")}
        nameLabel={t("nameLabel")}
      />
      <BuildingTable buildings={buildings} t={t} />
    </div>
  );
}
