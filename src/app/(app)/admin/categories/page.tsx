import { getLocale, getTranslations } from "next-intl/server";

import { TableFooterControls } from "@/components/TableFooterControls";
import {
  buildMasterDataPagerParams,
  buildMasterDataParamsWithoutPageSize,
  DEFAULT_MASTER_DATA_SORT_KEY,
  MASTER_DATA_SORT_KEYS,
  parseMasterDataListParams,
} from "@/lib/master-data-list-query";
import { ADMIN_CATEGORIES_PATH } from "@/lib/paths";
import { requireAdmin } from "@/lib/require-user";
import { countTablePages } from "@/lib/table-sort";

import { createCategoryAction } from "./actions";
import { CategoryForm } from "./CategoryForm";
import { CategoryTable } from "./CategoryTable";
import { listCategories } from "./queries";

interface AdminCategoriesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Admin-only category management (PRD FR-3.1, FR-3.2): list, create, edit
 * (via `[id]/page.tsx`) and deactivate. `src/app/(app)/admin/layout.tsx`
 * already refuses a non-admin before this page renders; `requireAdmin()` is
 * called again here per that layout's own comment — a cheap, explicit
 * belt-and-suspenders that also keeps this page consistent with every
 * server action underneath it, each of which calls it independently.
 */
export default async function AdminCategoriesPage({
  searchParams,
}: Readonly<AdminCategoriesPageProps>) {
  await requireAdmin();
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("AdminCategoriesPage"),
  ]);
  const params = parseMasterDataListParams(
    await searchParams,
    MASTER_DATA_SORT_KEYS,
    DEFAULT_MASTER_DATA_SORT_KEY,
  );
  const { rows, totalCount } = await listCategories(params);
  const base = new URLSearchParams();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <CategoryForm
        action={createCategoryAction}
        heading={t("createHeading")}
        submitLabel={t("createSubmit")}
        submitPendingLabel={t("createSubmitPending")}
        codeLabel={t("codeLabel")}
        nameLabel={t("nameLabel")}
        nameEnLabel={t("nameEnLabel")}
      />
      <CategoryTable categories={rows} params={params} locale={locale} t={t} />
      <TableFooterControls
        action={ADMIN_CATEGORIES_PATH}
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
        pageSizeSelectId="admin-categories-page-size"
      />
    </div>
  );
}
