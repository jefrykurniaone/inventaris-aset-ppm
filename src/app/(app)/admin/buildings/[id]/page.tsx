import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-user";

import { updateBuildingAction } from "../actions";
import { BuildingForm } from "../BuildingForm";

interface EditBuildingPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/** Building edit page (PRD FR-3.1, FR-3.3). */
export default async function EditBuildingPage({
  params,
}: Readonly<EditBuildingPageProps>) {
  await requireAdmin();
  const { id } = await params;
  const t = await getTranslations("AdminBuildingsPage");

  const building = await db.building.findUnique({ where: { id } });
  if (!building) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/buildings"
        className="text-primary text-sm hover:underline"
      >
        {t("backToList")}
      </Link>
      <BuildingForm
        action={updateBuildingAction}
        heading={t("editHeading")}
        submitLabel={t("editSubmit")}
        submitPendingLabel={t("editSubmitPending")}
        id={building.id}
        defaultCode={building.code}
        defaultName={building.name}
        codeLabel={t("codeLabel")}
        nameLabel={t("nameLabel")}
      />
    </div>
  );
}
