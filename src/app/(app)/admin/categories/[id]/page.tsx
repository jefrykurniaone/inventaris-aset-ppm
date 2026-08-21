import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-user";

import { updateCategoryAction } from "../actions";
import { CategoryForm } from "../CategoryForm";

interface EditCategoryPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Category edit page (PRD FR-3.1, FR-3.2). `code` is locked in the form the
 * moment any asset references this category — the actual enforcement is
 * `updateCategory` in `../mutations.ts`; this page only decides whether to
 * show the disabled-field courtesy and its explanatory notice.
 */
export default async function EditCategoryPage({
  params,
}: Readonly<EditCategoryPageProps>) {
  await requireAdmin();
  const { id } = await params;
  const t = await getTranslations("AdminCategoriesPage");

  const category = await db.category.findUnique({ where: { id } });
  if (!category) {
    notFound();
  }

  const referencedCount = await db.asset.count({ where: { categoryId: id } });
  const isCodeLocked = referencedCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/categories"
        className="text-primary text-sm hover:underline"
      >
        {t("backToList")}
      </Link>
      <CategoryForm
        action={updateCategoryAction}
        heading={t("editHeading")}
        submitLabel={t("editSubmit")}
        submitPendingLabel={t("editSubmitPending")}
        id={category.id}
        defaultCode={category.code}
        defaultName={category.name}
        defaultNameEn={category.nameEn}
        isCodeLocked={isCodeLocked}
        codeLockedNotice={
          isCodeLocked
            ? t("codeImmutableNotice", { count: referencedCount })
            : undefined
        }
        codeLabel={t("codeLabel")}
        nameLabel={t("nameLabel")}
        nameEnLabel={t("nameEnLabel")}
      />
    </div>
  );
}
