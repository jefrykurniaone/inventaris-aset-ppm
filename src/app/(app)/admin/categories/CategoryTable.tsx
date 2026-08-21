import { getTranslations } from "next-intl/server";

import { CategoryRow } from "./CategoryRow";
import type { CategoryListRow } from "./queries";

type AdminCategoriesT = Awaited<
  ReturnType<typeof getTranslations<"AdminCategoriesPage">>
>;

interface CategoryTableProps {
  readonly categories: readonly CategoryListRow[];
  readonly t: AdminCategoriesT;
}

const COLUMN_KEYS = [
  "columnCode",
  "columnName",
  "columnNameEn",
  "columnStatus",
  "columnEdit",
  "columnActive",
  "columnDelete",
] as const;

/** The category list itself (PRD FR-3.1), split out of `AdminCategoriesPage`
 * so that function stays inside the project's 40-line limit. */
export function CategoryTable({ categories, t }: Readonly<CategoryTableProps>) {
  if (categories.length === 0) {
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
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} t={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
