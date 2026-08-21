import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DeleteControl } from "@/components/DeleteControl";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/button";

import {
  deactivateCategoryAction,
  deleteCategoryAction,
  reactivateCategoryAction,
} from "./actions";
import type { CategoryListRow } from "./queries";

type AdminCategoriesT = Awaited<
  ReturnType<typeof getTranslations<"AdminCategoriesPage">>
>;

interface CategoryRowProps {
  readonly category: CategoryListRow;
  readonly t: AdminCategoriesT;
}

/** The deactivate/reactivate toggle, a plain form action exactly like
 * `admin/users`'s `UserRow` — no confirmation step, because it is
 * reversible. */
function ActiveToggle({ category, t }: Readonly<CategoryRowProps>) {
  const action = category.isActive
    ? deactivateCategoryAction
    : reactivateCategoryAction;
  const idleLabel = category.isActive ? t("deactivate") : t("reactivate");
  const pendingLabel = category.isActive
    ? t("deactivatePending")
    : t("reactivatePending");

  return (
    <form action={action}>
      <input type="hidden" name="id" value={category.id} />
      <SubmitButton
        variant="outline"
        idleLabel={idleLabel}
        pendingLabel={pendingLabel}
      />
    </form>
  );
}

/** Delete is only offered when nothing references this category yet (PRD
 * FR-3.4) — a courtesy the render decides from `assetCount`, backed by the
 * atomic check `deleteCategoryAction` performs regardless. */
function DeleteOrReferencedNote({ category, t }: Readonly<CategoryRowProps>) {
  if (category.assetCount > 0) {
    return (
      <span className="text-muted-foreground text-sm">
        {t("referencedByAssets", { count: category.assetCount })}
      </span>
    );
  }

  return (
    <DeleteControl
      action={deleteCategoryAction}
      id={category.id}
      triggerLabel={t("delete")}
      pendingLabel={t("deletePending")}
      title={t("deleteConfirmTitle", { code: category.code })}
      description={t("deleteConfirmDescription")}
      cancelLabel={t("cancel")}
      confirmLabel={t("deleteConfirm")}
    />
  );
}

/** One row of the category list, split out of `CategoryTable` to keep every
 * function in this feature under the project's 40-line limit. */
export function CategoryRow({ category, t }: Readonly<CategoryRowProps>) {
  return (
    <tr className="border-border border-b align-top">
      <td className="py-2 pr-4 font-mono">{category.code}</td>
      <td className="py-2 pr-4">{category.name}</td>
      <td className="py-2 pr-4">{category.nameEn}</td>
      <td className="py-2 pr-4">
        {category.isActive ? t("statusActive") : t("statusDeactivated")}
      </td>
      <td className="py-2 pr-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/categories/${category.id}`}>{t("edit")}</Link>
        </Button>
      </td>
      <td className="py-2 pr-4">
        <ActiveToggle category={category} t={t} />
      </td>
      <td className="py-2">
        <DeleteOrReferencedNote category={category} t={t} />
      </td>
    </tr>
  );
}
