import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/require-user";

import { createCategoryAction } from "./actions";
import { CategoryForm } from "./CategoryForm";
import { CategoryTable } from "./CategoryTable";
import { listCategories } from "./queries";

/**
 * Admin-only category management (PRD FR-3.1, FR-3.2): list, create, edit
 * (via `[id]/page.tsx`) and deactivate. `src/app/(app)/admin/layout.tsx`
 * already refuses a non-admin before this page renders; `requireAdmin()` is
 * called again here per that layout's own comment — a cheap, explicit
 * belt-and-suspenders that also keeps this page consistent with every
 * server action underneath it, each of which calls it independently.
 */
export default async function AdminCategoriesPage() {
  await requireAdmin();
  const t = await getTranslations("AdminCategoriesPage");
  const categories = await listCategories();

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
      <CategoryTable categories={categories} t={t} />
    </div>
  );
}
