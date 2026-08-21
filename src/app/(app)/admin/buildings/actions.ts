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
  createBuilding,
  deleteBuilding,
  setBuildingActive,
  updateBuilding,
  type MutationFailureReason,
} from "./mutations";
import {
  buildingIdSchema,
  buildingSchema,
  type BuildingFieldErrors,
  type BuildingFormState,
} from "./schemas";

const BUILDINGS_PATH = "/admin/buildings";

type Translate = Awaited<
  ReturnType<typeof getTranslations<"AdminBuildingsPage">>
>;

function logActionError(action: string, input: unknown, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `admin/buildings/actions.${action}: input=${JSON.stringify(input)} — ${message}`,
  );
}

type BuildingFieldName = keyof BuildingFieldErrors;

const FIELD_ERROR_KEYS: Record<BuildingFieldName, Parameters<Translate>[0]> = {
  code: "codeRequired",
  name: "nameRequired",
};

function isBuildingFieldName(value: PropertyKey): value is BuildingFieldName {
  return value === "code" || value === "name";
}

function buildFieldErrors(
  t: Translate,
  issues: ReadonlyArray<{ path: PropertyKey[] }>,
): BuildingFieldErrors {
  const fieldErrors: BuildingFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isBuildingFieldName(field)) {
      fieldErrors[field] = t(FIELD_ERROR_KEYS[field]);
    }
  }
  return fieldErrors;
}

function reasonToFormError(
  t: Translate,
  reason: MutationFailureReason,
): string {
  switch (reason) {
    case "DUPLICATE_CODE":
      return t("codeAlreadyUsed");
    case "NOT_FOUND":
      return t("notFound");
    default:
      return t("unexpectedError");
  }
}

function parseBuildingForm(formData: FormData) {
  return buildingSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
  });
}

/** Creates a building (PRD FR-3.1). `requireAdmin()` is the first
 * statement — the boundary the "staff caller refused" test targets. */
export async function createBuildingAction(
  _previousState: BuildingFormState,
  formData: FormData,
): Promise<BuildingFormState> {
  await requireAdmin();
  const t = await getTranslations("AdminBuildingsPage");
  const parsed = parseBuildingForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await createBuilding(parsed.data);
  if (!result.ok) {
    return {
      fieldErrors: {},
      formError: reasonToFormError(t, result.reason),
      isSuccess: false,
    };
  }

  revalidatePath(BUILDINGS_PATH);
  return { fieldErrors: {}, formError: null, isSuccess: true };
}

export async function updateBuildingAction(
  _previousState: BuildingFormState,
  formData: FormData,
): Promise<BuildingFormState> {
  await requireAdmin();
  const t = await getTranslations("AdminBuildingsPage");
  const id = buildingIdSchema.parse(formData.get("id"));
  const parsed = parseBuildingForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await updateBuilding(id, parsed.data);
  if (!result.ok) {
    return {
      fieldErrors: {},
      formError: reasonToFormError(t, result.reason),
      isSuccess: false,
    };
  }

  revalidatePath(BUILDINGS_PATH);
  redirect(BUILDINGS_PATH);
}

/**
 * Deletes a building, or reports it is still referenced. `deleteBuilding`
 * attempts the delete directly (see its own comment), so a room added
 * after this row was rendered still yields this same localised message.
 */
export async function deleteBuildingAction(
  _previousState: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  await requireAdmin();
  const t = await getTranslations("AdminBuildingsPage");
  const id = buildingIdSchema.parse(formData.get("id"));

  const result = await deleteBuilding(id);
  if (!result.ok) {
    const formError =
      result.reason === "REFERENCED"
        ? t("stillReferenced")
        : t("unexpectedError");
    return { formError };
  }

  revalidatePath(BUILDINGS_PATH);
  return INITIAL_DELETE_STATE;
}

async function setActiveAction(id: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  try {
    const result = await setBuildingActive(id, isActive);
    if (!result.ok) {
      logActionError("setActiveAction", { id, isActive }, result.reason);
      return;
    }
  } catch (error) {
    logActionError("setActiveAction", { id, isActive }, error);
    return;
  }
  revalidatePath(BUILDINGS_PATH);
}

export async function deactivateBuildingAction(
  formData: FormData,
): Promise<void> {
  const id = buildingIdSchema.parse(formData.get("id"));
  await setActiveAction(id, false);
}

export async function reactivateBuildingAction(
  formData: FormData,
): Promise<void> {
  const id = buildingIdSchema.parse(formData.get("id"));
  await setActiveAction(id, true);
}
