import { getTranslations } from "next-intl/server";

import { BuildingRow } from "./BuildingRow";
import type { BuildingListRow } from "./queries";

type AdminBuildingsT = Awaited<
  ReturnType<typeof getTranslations<"AdminBuildingsPage">>
>;

interface BuildingTableProps {
  readonly buildings: readonly BuildingListRow[];
  readonly t: AdminBuildingsT;
}

const COLUMN_KEYS = [
  "columnCode",
  "columnName",
  "columnStatus",
  "columnEdit",
  "columnActive",
  "columnDelete",
] as const;

/** The building list itself (PRD FR-3.1, FR-3.3), split out of
 * `AdminBuildingsPage` so that function stays under the 40-line limit. */
export function BuildingTable({ buildings, t }: Readonly<BuildingTableProps>) {
  if (buildings.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("emptyState")}</p>;
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
          {buildings.map((building) => (
            <BuildingRow key={building.id} building={building} t={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
