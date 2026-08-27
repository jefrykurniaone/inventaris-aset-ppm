import { getLocale, getTranslations } from "next-intl/server";

import { listActiveBuildingOptions } from "@/app/(app)/admin/buildings/queries";
import { TableFooterControls } from "@/components/TableFooterControls";
import {
  buildMasterDataPagerParams,
  buildMasterDataParamsWithoutPageSize,
  DEFAULT_MASTER_DATA_SORT_KEY,
  MASTER_DATA_SORT_KEYS,
  parseMasterDataListParams,
} from "@/lib/master-data-list-query";
import { ADMIN_ROOMS_PATH } from "@/lib/paths";
import { requireAdmin } from "@/lib/require-user";
import { countTablePages } from "@/lib/table-sort";

import { createRoomAction } from "./actions";
import { listRooms } from "./queries";
import { RoomBuildingFilter } from "./RoomBuildingFilter";
import { RoomForm } from "./RoomForm";
import { roomBuildingFilterSchema } from "./schemas";
import { RoomTable } from "./RoomTable";

interface AdminRoomsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The building filter as a query string, carried into every sort header,
 * pager link and page-size submission so reordering or paging never drops
 * it. Empty when no building is selected. */
function buildingFilterParams(buildingId?: string): URLSearchParams {
  const base = new URLSearchParams();
  if (buildingId) {
    base.set("buildingId", buildingId);
  }
  return base;
}

/**
 * Admin-only room management (PRD FR-3.1, FR-3.3): list — filterable by
 * building — create, edit (via `[id]/page.tsx`) and deactivate. Sorted by
 * clicking a column header and paginated server-side since issue #87.
 */
export default async function AdminRoomsPage({
  searchParams,
}: Readonly<AdminRoomsPageProps>) {
  await requireAdmin();
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("AdminRoomsPage"),
  ]);
  const rawParams = await searchParams;
  const buildingId = roomBuildingFilterSchema.parse(
    typeof rawParams.buildingId === "string" ? rawParams.buildingId : undefined,
  );
  const params = parseMasterDataListParams(
    rawParams,
    MASTER_DATA_SORT_KEYS,
    DEFAULT_MASTER_DATA_SORT_KEY,
  );
  const base = buildingFilterParams(buildingId);

  const [{ rows, totalCount }, buildingOptions] = await Promise.all([
    listRooms(params, buildingId),
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
        viewParams={buildMasterDataParamsWithoutPageSize(
          new URLSearchParams(),
          params,
          DEFAULT_MASTER_DATA_SORT_KEY,
        )}
        t={t}
      />
      <RoomTable
        rooms={rows}
        params={params}
        base={base}
        locale={locale}
        t={t}
        emptyStateKey={buildingId ? "emptyStateFiltered" : "emptyState"}
      />
      <TableFooterControls
        action={ADMIN_ROOMS_PATH}
        pageSizeParams={buildMasterDataParamsWithoutPageSize(
          base,
          params,
          DEFAULT_MASTER_DATA_SORT_KEY,
        )}
        pagerParams={buildMasterDataPagerParams(
          base,
          params,
          DEFAULT_MASTER_DATA_SORT_KEY,
        )}
        page={params.page}
        pageSize={params.pageSize}
        pageCount={countTablePages(totalCount, params.pageSize)}
        totalCount={totalCount}
        pageSizeSelectId="admin-rooms-page-size"
      />
    </div>
  );
}
