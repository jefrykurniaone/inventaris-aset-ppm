import { getTranslations } from "next-intl/server";

import { HiddenSearchParams } from "@/components/HiddenSearchParams";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ADMIN_ROOMS_PATH } from "@/lib/paths";

type AdminRoomsT = Awaited<
  ReturnType<typeof getTranslations<"AdminRoomsPage">>
>;

interface BuildingOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

interface RoomBuildingFilterProps {
  readonly buildingOptions: readonly BuildingOption[];
  readonly selectedBuildingId?: string;
  /** The sort key, direction and page size, carried as hidden fields so
   * changing the building keeps the ordering the reader chose. A `GET` form
   * replaces the query string wholesale, so anything not a field is lost. */
  readonly viewParams: URLSearchParams;
  readonly t: AdminRoomsT;
}

/**
 * The room list's building filter (PRD FR-3.3). A plain `GET` form — no
 * client-side JavaScript, no auto-submit-on-change, so choosing a building
 * never triggers an unannounced page change (WCAG 3.2.2): the filter only
 * applies once the visible, keyboard-reachable submit button is activated.
 */
export function RoomBuildingFilter({
  buildingOptions,
  selectedBuildingId,
  viewParams,
  t,
}: Readonly<RoomBuildingFilterProps>) {
  return (
    <form
      action={ADMIN_ROOMS_PATH}
      method="get"
      className="flex flex-wrap items-end gap-2"
    >
      <HiddenSearchParams params={viewParams} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="room-building-filter">{t("filterBuildingLabel")}</Label>
        <Select
          id="room-building-filter"
          name="buildingId"
          defaultValue={selectedBuildingId ?? ""}
        >
          <option value="">{t("filterAllBuildings")}</option>
          {buildingOptions.map((building) => (
            <option key={building.id} value={building.id}>
              {`${building.code} — ${building.name}`}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="outline">
        {t("filterSubmit")}
      </Button>
    </form>
  );
}
