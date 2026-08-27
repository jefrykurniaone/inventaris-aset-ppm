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
import { ADMIN_BUILDINGS_PATH } from "@/lib/paths";

import { BuildingRow } from "./BuildingRow";
import type { BuildingListRow } from "./queries";

type AdminBuildingsT = Awaited<
  ReturnType<typeof getTranslations<"AdminBuildingsPage">>
>;

type AdminBuildingsMessageKey = Parameters<AdminBuildingsT>[0];

interface BuildingTableProps {
  readonly buildings: readonly BuildingListRow[];
  readonly params: MasterDataListParams<MasterDataSortKey>;
  readonly locale: Locale;
  readonly t: AdminBuildingsT;
}

interface BuildingColumn {
  readonly id: string;
  readonly labelKey: AdminBuildingsMessageKey;
  readonly sortKey?: MasterDataSortKey;
}

/** The curated sortable set (issue #87): code, name and creation time. The
 * status cell holds two values, and the last three columns are controls. */
const BUILDING_COLUMNS: readonly BuildingColumn[] = [
  { id: "code", labelKey: "columnCode", sortKey: "code" },
  { id: "name", labelKey: "columnName", sortKey: "name" },
  { id: "status", labelKey: "columnStatus" },
  { id: "createdAt", labelKey: "columnCreatedAt", sortKey: "createdAt" },
  { id: "edit", labelKey: "columnEdit" },
  { id: "active", labelKey: "columnActive" },
  { id: "delete", labelKey: "columnDelete" },
];

function toColumnSpecs(
  t: AdminBuildingsT,
): readonly TableColumnSpec<MasterDataSortKey>[] {
  return BUILDING_COLUMNS.map((column) => ({
    id: column.id,
    label: t(column.labelKey),
    sortKey: column.sortKey,
    initialDirection: column.sortKey === "createdAt" ? "desc" : "asc",
  }));
}

/** The building list itself (PRD FR-3.1, FR-3.3), split out of
 * `AdminBuildingsPage` so that function stays under the 40-line limit. */
export function BuildingTable({
  buildings,
  params,
  locale,
  t,
}: Readonly<BuildingTableProps>) {
  if (buildings.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("emptyState")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            <TableHeaderCells
              action={ADMIN_BUILDINGS_PATH}
              columns={toColumnSpecs(t)}
              sortKey={params.sort}
              direction={params.dir}
              paramsFor={(sortKey, direction) =>
                withMasterDataSort(
                  new URLSearchParams(),
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
          {buildings.map((building) => (
            <BuildingRow
              key={building.id}
              building={building}
              locale={locale}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
