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
import { ADMIN_CATEGORIES_PATH } from "@/lib/paths";

import { CategoryRow } from "./CategoryRow";
import type { CategoryListRow } from "./queries";

type AdminCategoriesT = Awaited<
  ReturnType<typeof getTranslations<"AdminCategoriesPage">>
>;

type AdminCategoriesMessageKey = Parameters<AdminCategoriesT>[0];

interface CategoryTableProps {
  readonly categories: readonly CategoryListRow[];
  readonly params: MasterDataListParams<MasterDataSortKey>;
  readonly locale: Locale;
  readonly t: AdminCategoriesT;
}

interface CategoryColumn {
  readonly id: string;
  readonly labelKey: AdminCategoriesMessageKey;
  readonly sortKey?: MasterDataSortKey;
}

/** The curated sortable set (issue #87): code, the Indonesian name and
 * creation time. The English name is a second spelling of the same row, and
 * sorting on it would only reorder rows already ordered by their pair. */
const CATEGORY_COLUMNS: readonly CategoryColumn[] = [
  { id: "code", labelKey: "columnCode", sortKey: "code" },
  { id: "name", labelKey: "columnName", sortKey: "name" },
  { id: "nameEn", labelKey: "columnNameEn" },
  { id: "status", labelKey: "columnStatus" },
  { id: "createdAt", labelKey: "columnCreatedAt", sortKey: "createdAt" },
  { id: "edit", labelKey: "columnEdit" },
  { id: "active", labelKey: "columnActive" },
  { id: "delete", labelKey: "columnDelete" },
];

function toColumnSpecs(
  t: AdminCategoriesT,
): readonly TableColumnSpec<MasterDataSortKey>[] {
  return CATEGORY_COLUMNS.map((column) => ({
    id: column.id,
    label: t(column.labelKey),
    sortKey: column.sortKey,
    initialDirection: column.sortKey === "createdAt" ? "desc" : "asc",
  }));
}

/** The category list itself (PRD FR-3.1), split out of `AdminCategoriesPage`
 * so that function stays inside the project's 40-line limit. */
export function CategoryTable({
  categories,
  params,
  locale,
  t,
}: Readonly<CategoryTableProps>) {
  if (categories.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("emptyState")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            <TableHeaderCells
              action={ADMIN_CATEGORIES_PATH}
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
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              locale={locale}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
