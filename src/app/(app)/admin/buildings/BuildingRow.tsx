import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DeleteControl } from "@/components/DeleteControl";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/button";

import {
  deactivateBuildingAction,
  deleteBuildingAction,
  reactivateBuildingAction,
} from "./actions";
import type { BuildingListRow } from "./queries";

type AdminBuildingsT = Awaited<
  ReturnType<typeof getTranslations<"AdminBuildingsPage">>
>;

interface BuildingRowProps {
  readonly building: BuildingListRow;
  readonly t: AdminBuildingsT;
}

/** The deactivate/reactivate toggle — reversible, so no confirmation step. */
function ActiveToggle({ building, t }: Readonly<BuildingRowProps>) {
  const action = building.isActive
    ? deactivateBuildingAction
    : reactivateBuildingAction;
  const idleLabel = building.isActive ? t("deactivate") : t("reactivate");
  const pendingLabel = building.isActive
    ? t("deactivatePending")
    : t("reactivatePending");

  return (
    <form action={action}>
      <input type="hidden" name="id" value={building.id} />
      <SubmitButton
        variant="outline"
        idleLabel={idleLabel}
        pendingLabel={pendingLabel}
      />
    </form>
  );
}

/** Delete is only offered when the building has no rooms yet (PRD FR-3.3,
 * FR-3.4) — `Room.buildingId` is what actually refuses the delete at the
 * database, and `deleteBuildingAction` re-checks that atomically. */
function DeleteOrReferencedNote({ building, t }: Readonly<BuildingRowProps>) {
  if (building.roomCount > 0) {
    return (
      <span className="text-muted-foreground text-sm">
        {t("referencedByRooms", { count: building.roomCount })}
      </span>
    );
  }

  return (
    <DeleteControl
      action={deleteBuildingAction}
      id={building.id}
      triggerLabel={t("delete")}
      pendingLabel={t("deletePending")}
      title={t("deleteConfirmTitle", { code: building.code })}
      description={t("deleteConfirmDescription")}
      cancelLabel={t("cancel")}
      confirmLabel={t("deleteConfirm")}
    />
  );
}

/** One row of the building list, split out of `BuildingTable` to keep every
 * function in this feature under the project's 40-line limit. */
export function BuildingRow({ building, t }: Readonly<BuildingRowProps>) {
  return (
    <tr className="border-border border-b align-top">
      <td className="py-2 pr-4 font-mono">{building.code}</td>
      <td className="py-2 pr-4">{building.name}</td>
      <td className="py-2 pr-4">
        {building.isActive ? t("statusActive") : t("statusDeactivated")}
      </td>
      <td className="py-2 pr-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/buildings/${building.id}`}>{t("edit")}</Link>
        </Button>
      </td>
      <td className="py-2 pr-4">
        <ActiveToggle building={building} t={t} />
      </td>
      <td className="py-2">
        <DeleteOrReferencedNote building={building} t={t} />
      </td>
    </tr>
  );
}
