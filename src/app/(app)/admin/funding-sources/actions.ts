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
  createFundingSource,
  deleteFundingSource,
  setFundingSourceActive,
  updateFundingSource,
  type MutationFailureReason,
} from "./mutations";
import {
  fundingSourceIdSchema,
  fundingSourceSchema,
  type FundingSourceFieldErrors,
  type FundingSourceFormState,
} from "./schemas";

const FUNDING_SOURCES_PATH = "/admin/funding-sources";

type Translate = Awaited<
  ReturnType<typeof getTranslations<"AdminFundingSourcesPage">>
>;

function logActionError(action: string, input: unknown, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `admin/funding-sources/actions.${action}: input=${JSON.stringify(input)} — ${message}`,
  );
}

type FundingSourceFieldName = keyof FundingSourceFieldErrors;

const FIELD_ERROR_KEYS: Record<
  FundingSourceFieldName,
  Parameters<Translate>[0]
> = {
  name: "nameRequired",
  notes: "notesTooLong",
};

function isFundingSourceFieldName(
  value: PropertyKey,
): value is FundingSourceFieldName {
  return value === "name" || value === "notes";
}

function buildFieldErrors(
  t: Translate,
  issues: ReadonlyArray<{ path: PropertyKey[] }>,
): FundingSourceFieldErrors {
  const fieldErrors: FundingSourceFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isFundingSourceFieldName(field)) {
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
    case "DUPLICATE_NAME":
      return t("nameAlreadyUsed");
    case "NOT_FOUND":
      return t("notFound");
    default:
      return t("unexpectedError");
  }
}

function parseFundingSourceForm(formData: FormData) {
  return fundingSourceSchema.safeParse({
    name: formData.get("name"),
    notes: formData.get("notes"),
  });
}

/** Creates a funding source (PRD FR-3.1). `requireAdmin()` is the first
 * statement — the boundary the "staff caller refused" test targets. */
export async function createFundingSourceAction(
  _previousState: FundingSourceFormState,
  formData: FormData,
): Promise<FundingSourceFormState> {
  await requireAdmin();
  const t = await getTranslations("AdminFundingSourcesPage");
  const parsed = parseFundingSourceForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await createFundingSource(parsed.data);
  if (!result.ok) {
    return {
      fieldErrors: {},
      formError: reasonToFormError(t, result.reason),
      isSuccess: false,
    };
  }

  revalidatePath(FUNDING_SOURCES_PATH);
  return { fieldErrors: {}, formError: null, isSuccess: true };
}

export async function updateFundingSourceAction(
  _previousState: FundingSourceFormState,
  formData: FormData,
): Promise<FundingSourceFormState> {
  await requireAdmin();
  const t = await getTranslations("AdminFundingSourcesPage");
  const id = fundingSourceIdSchema.parse(formData.get("id"));
  const parsed = parseFundingSourceForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await updateFundingSource(id, parsed.data);
  if (!result.ok) {
    return {
      fieldErrors: {},
      formError: reasonToFormError(t, result.reason),
      isSuccess: false,
    };
  }

  revalidatePath(FUNDING_SOURCES_PATH);
  redirect(FUNDING_SOURCES_PATH);
}

/**
 * Deletes a funding source, or reports it is still referenced.
 * `deleteFundingSource` attempts the delete directly, so an asset assigned
 * this funding source after this row was rendered still produces this same
 * localised message rather than a crash.
 */
export async function deleteFundingSourceAction(
  _previousState: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  await requireAdmin();
  const t = await getTranslations("AdminFundingSourcesPage");
  const id = fundingSourceIdSchema.parse(formData.get("id"));

  const result = await deleteFundingSource(id);
  if (!result.ok) {
    const formError =
      result.reason === "REFERENCED"
        ? t("stillReferenced")
        : t("unexpectedError");
    return { formError };
  }

  revalidatePath(FUNDING_SOURCES_PATH);
  return INITIAL_DELETE_STATE;
}

async function setActiveAction(id: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  try {
    const result = await setFundingSourceActive(id, isActive);
    if (!result.ok) {
      logActionError("setActiveAction", { id, isActive }, result.reason);
      return;
    }
  } catch (error) {
    logActionError("setActiveAction", { id, isActive }, error);
    return;
  }
  revalidatePath(FUNDING_SOURCES_PATH);
}

export async function deactivateFundingSourceAction(
  formData: FormData,
): Promise<void> {
  const id = fundingSourceIdSchema.parse(formData.get("id"));
  await setActiveAction(id, false);
}

export async function reactivateFundingSourceAction(
  formData: FormData,
): Promise<void> {
  const id = fundingSourceIdSchema.parse(formData.get("id"));
  await setActiveAction(id, true);
}
