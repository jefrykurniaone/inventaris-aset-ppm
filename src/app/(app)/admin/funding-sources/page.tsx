import { getLocale, getTranslations } from "next-intl/server";

import { TableFooterControls } from "@/components/TableFooterControls";
import {
  buildMasterDataPagerParams,
  buildMasterDataParamsWithoutPageSize,
  DEFAULT_FUNDING_SOURCE_SORT_KEY,
  FUNDING_SOURCE_SORT_KEYS,
  parseMasterDataListParams,
} from "@/lib/master-data-list-query";
import { ADMIN_FUNDING_SOURCES_PATH } from "@/lib/paths";
import { requireAdmin } from "@/lib/require-user";
import { countTablePages } from "@/lib/table-sort";

import { createFundingSourceAction } from "./actions";
import { FundingSourceForm } from "./FundingSourceForm";
import { FundingSourceTable } from "./FundingSourceTable";
import { listFundingSources } from "./queries";

interface AdminFundingSourcesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Admin-only funding source management (PRD FR-3.1): list, create, edit
 * (via `[id]/page.tsx`) and deactivate. Sorted by clicking a column header
 * and paginated server-side since issue #87; the default stays name order,
 * this table having no code column.
 */
export default async function AdminFundingSourcesPage({
  searchParams,
}: Readonly<AdminFundingSourcesPageProps>) {
  await requireAdmin();
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("AdminFundingSourcesPage"),
  ]);
  const params = parseMasterDataListParams(
    await searchParams,
    FUNDING_SOURCE_SORT_KEYS,
    DEFAULT_FUNDING_SOURCE_SORT_KEY,
  );
  const { rows, totalCount } = await listFundingSources(params);
  const base = new URLSearchParams();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <FundingSourceForm
        action={createFundingSourceAction}
        heading={t("createHeading")}
        submitLabel={t("createSubmit")}
        submitPendingLabel={t("createSubmitPending")}
        nameLabel={t("nameLabel")}
        notesLabel={t("notesLabel")}
      />
      <FundingSourceTable
        fundingSources={rows}
        params={params}
        locale={locale}
        t={t}
      />
      <TableFooterControls
        action={ADMIN_FUNDING_SOURCES_PATH}
        pageSizeParams={buildMasterDataParamsWithoutPageSize(
          base,
          params,
          DEFAULT_FUNDING_SOURCE_SORT_KEY,
        )}
        pagerParams={buildMasterDataPagerParams(
          base,
          params,
          DEFAULT_FUNDING_SOURCE_SORT_KEY,
        )}
        page={params.page}
        pageSize={params.pageSize}
        pageCount={countTablePages(totalCount, params.pageSize)}
        totalCount={totalCount}
        pageSizeSelectId="admin-funding-sources-page-size"
      />
    </div>
  );
}
