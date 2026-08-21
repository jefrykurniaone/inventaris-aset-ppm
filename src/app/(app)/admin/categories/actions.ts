"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  INITIAL_DELETE_STATE,
  type DeleteState,
} from "@/app/(app)/admin/delete-state";
import { requireAdmin } from "@/lib/require-user";

import {
  createCategory,
  deleteCategory,
  setCategoryActive,
  updateCategory,
  type MutationFailureReason,
} from "./mutations";
import {
  categoryIdSchema,
  categorySchema,
  type CategoryFieldErrors,
  type CategoryFormState,
} from "./schemas";

const CATEGORIES_PATH = "/admin/categories";

type Translate = Awaited<
  ReturnType<typeof getTranslations<"AdminCategoriesPage">>
>;

function logActionError(action: string, input: unknown, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `admin/categories/actions.${action}: input=${JSON.stringify(input)} — ${message}`,
  );
}

type CategoryFieldName = keyof CategoryFieldErrors;

const FIELD_ERROR_KEYS: Record<CategoryFieldName, Parameters<Translate>[0]> = {
  code: "codeInvalid",
  name: "nameRequired",
  nameEn: "nameEnRequired",
};

function isCategoryFieldName(value: PropertyKey): value is CategoryFieldName {
  return value === "code" || value === "name" || value === "nameEn";
}

function buildFieldErrors(
  t: Translate,
  issues: ReadonlyArray<{ path: PropertyKey[] }>,
): CategoryFieldErrors {
  const fieldErrors: CategoryFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isCategoryFieldName(field)) {
      fieldErrors[field] = t(FIELD_ERROR_KEYS[field]);
    }
  }
  return fieldErrors;
}

/** Maps a mutation failure reason to the one form-level message it implies
 * on the create/edit form, kept out of the two actions below so neither
 * exceeds the project's 40-line limit. */
function reasonToFormError(
  t: Translate,
  reason: MutationFailureReason,
): string {
  switch (reason) {
    case "DUPLICATE_CODE":
      return t("codeAlreadyUsed");
    case "CODE_IMMUTABLE":
      return t("codeImmutable");
    case "NOT_FOUND":
      return t("notFound");
    default:
      return t("unexpectedError");
  }
}

function parseCategoryForm(formData: FormData) {
  return categorySchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    nameEn: formData.get("nameEn"),
  });
}

/** Creates a category (PRD FR-3.1). `requireAdmin()` is the first statement
 * — the authorisation boundary the "staff caller refused" test targets. */
export async function createCategoryAction(
  _previousState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();
  const t = await getTranslations("AdminCategoriesPage");
  const parsed = parseCategoryForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await createCategory(parsed.data);
  if (!result.ok) {
    return {
      fieldErrors: {},
      formError: reasonToFormError(t, result.reason),
      isSuccess: false,
    };
  }

  revalidatePath(CATEGORIES_PATH);
  return { fieldErrors: {}, formError: null, isSuccess: true };
}

/**
 * Updates a category. `code` immutability once referenced (PRD FR-3.2) is
 * enforced inside `updateCategory` against the real reference count, not by
 * trusting that the form field was disabled — see `mutations.ts`.
 */
export async function updateCategoryAction(
  _previousState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();
  const t = await getTranslations("AdminCategoriesPage");
  const id = categoryIdSchema.parse(formData.get("id"));
  const parsed = parseCategoryForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await updateCategory(id, parsed.data);
  if (!result.ok) {
    return {
      fieldErrors: {},
      formError: reasonToFormError(t, result.reason),
      isSuccess: false,
    };
  }

  revalidatePath(CATEGORIES_PATH);
  redirect(CATEGORIES_PATH);
}

/**
 * Deletes a category, or reports that it is still referenced. The delete
 * itself is attempted directly inside `deleteCategory` rather than decided
 * from a separate count query, so a reference created after this row was
 * rendered still produces this same localised message instead of a crash.
 */
export async function deleteCategoryAction(
  _previousState: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  await requireAdmin();
  const t = await getTranslations("AdminCategoriesPage");
  const id = categoryIdSchema.parse(formData.get("id"));

  const result = await deleteCategory(id);
  if (!result.ok) {
    const formError =
      result.reason === "REFERENCED"
        ? t("stillReferenced")
        : t("unexpectedError");
    return { formError };
  }

  revalidatePath(CATEGORIES_PATH);
  return INITIAL_DELETE_STATE;
}

async function setActiveAction(id: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  try {
    const result = await setCategoryActive(id, isActive);
    if (!result.ok) {
      logActionError("setActiveAction", { id, isActive }, result.reason);
      return;
    }
  } catch (error) {
    logActionError("setActiveAction", { id, isActive }, error);
    return;
  }
  revalidatePath(CATEGORIES_PATH);
}

export async function deactivateCategoryAction(
  formData: FormData,
): Promise<void> {
  const id = categoryIdSchema.parse(formData.get("id"));
  await setActiveAction(id, false);
}

export async function reactivateCategoryAction(
  formData: FormData,
): Promise<void> {
  const id = categoryIdSchema.parse(formData.get("id"));
  await setActiveAction(id, true);
}
