import { getLocale, getTranslations } from "next-intl/server";

import { TableFooterControls } from "@/components/TableFooterControls";
import {
  buildMasterDataPagerParams,
  buildMasterDataParamsWithoutPageSize,
  DEFAULT_MASTER_DATA_SORT_KEY,
  MASTER_DATA_SORT_KEYS,
  parseMasterDataListParams,
} from "@/lib/master-data-list-query";
import { ADMIN_BUILDINGS_PATH } from "@/lib/paths";
import { requireAdmin } from "@/lib/require-user";
import { countTablePages } from "@/lib/table-sort";

import { createBuildingAction } from "./actions";
import { BuildingForm } from "./BuildingForm";
import { BuildingTable } from "./BuildingTable";
import { listBuildings } from "./queries";

interface AdminBuildingsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Admin-only building management (PRD FR-3.1, FR-3.3): list, create, edit
 * (via `[id]/page.tsx`) and deactivate. Sorted by clicking a column header
 * and paginated server-side since issue #87; the default stays code order.
 */
export default async function AdminBuildingsPage({
  searchParams,
}: Readonly<AdminBuildingsPageProps>) {
  await requireAdmin();
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("AdminBuildingsPage"),
  ]);
  const params = parseMasterDataListParams(
    await searchParams,
    MASTER_DATA_SORT_KEYS,
    DEFAULT_MASTER_DATA_SORT_KEY,
  );
  const { rows, totalCount } = await listBuildings(params);
  const base = new URLSearchParams();

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
      <BuildingTable buildings={rows} params={params} locale={locale} t={t} />
      <TableFooterControls
        action={ADMIN_BUILDINGS_PATH}
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
        pageSizeSelectId="admin-buildings-page-size"
      />
    </div>
  );
}
