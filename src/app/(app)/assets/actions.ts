"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  INITIAL_DELETE_STATE,
  type DeleteState,
} from "@/app/(app)/admin/delete-state";
import { ASSETS_PATH } from "@/lib/paths";
import { requireUser } from "@/lib/require-user";

import {
  createAsset,
  softDeleteAsset,
  updateAsset,
  type MutationFailureReason,
} from "./mutations";
import {
  ASSET_FIELD_NAMES,
  assetIdSchema,
  assetSchema,
  REQUIRED_ASSET_FIELD_NAMES,
  type AssetFieldErrors,
  type AssetFieldName,
  type AssetFormState,
} from "./schemas";

/**
 * Server actions for the asset register (PRD FR-2.1 to FR-2.5).
 *
 * `requireUser()`, not `requireAdmin()`, is the first statement of every one
 * of them: FR-1.4 gives `staff` the right to create and edit assets, and the
 * restricted financial and custodian fields are restricted on *read by
 * audience* (§8.2), never by role — a signed-in staff member fills them in.
 */

const ASSET_FIELD_NAME_SET: ReadonlySet<string> = new Set(ASSET_FIELD_NAMES);
const REQUIRED_FIELD_NAME_SET: ReadonlySet<string> = new Set(
  REQUIRED_ASSET_FIELD_NAMES,
);

type Translate = Awaited<ReturnType<typeof getTranslations<"AssetsPage">>>;

/** One localised message per field, reused across the fields whose only
 * failure mode is the shared length bound. */
const FIELD_ERROR_KEYS: Record<AssetFieldName, Parameters<Translate>[0]> = {
  name: "nameRequired",
  categoryId: "categoryRequired",
  roomId: "roomRequired",
  condition: "conditionRequired",
  status: "statusRequired",
  acquisitionYear: "acquisitionYearInvalid",
  brand: "textTooLong",
  model: "textTooLong",
  serialNumber: "textTooLong",
  universityAssetCode: "textTooLong",
  notes: "notesTooLong",
  purchasePrice: "purchasePriceInvalid",
  fundingSourceId: "fundingSourceInvalid",
  procurementDocNo: "textTooLong",
  vendor: "textTooLong",
  warrantyUntil: "warrantyUntilInvalid",
  custodianName: "textTooLong",
  custodianEmail: "custodianEmailInvalid",
};

function isAssetFieldName(value: PropertyKey): value is AssetFieldName {
  return typeof value === "string" && ASSET_FIELD_NAME_SET.has(value);
}

function buildFieldErrors(
  t: Translate,
  issues: ReadonlyArray<{ path: PropertyKey[] }>,
): AssetFieldErrors {
  const fieldErrors: AssetFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isAssetFieldName(field)) {
      fieldErrors[field] = t(FIELD_ERROR_KEYS[field]);
    }
  }
  return fieldErrors;
}

/**
 * Reads one form entry.
 *
 * `formData.get` returns `string | File | null`, and `String(...)` on a `File`
 * yields `[object File]` (S6551), which would then be validated as though it
 * were a field value. Anything that is not a string reads as absent. An
 * optional field submitted empty also reads as absent, so "not given" has one
 * representation reaching the schema — `undefined` — rather than two.
 */
function readField(
  formData: FormData,
  name: AssetFieldName,
): string | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === "" && !REQUIRED_FIELD_NAME_SET.has(name)) {
    return undefined;
  }
  return value;
}

function parseAssetForm(formData: FormData) {
  const raw: Partial<Record<AssetFieldName, string>> = {};
  for (const field of ASSET_FIELD_NAMES) {
    const value = readField(formData, field);
    if (value !== undefined) {
      raw[field] = value;
    }
  }
  return assetSchema.safeParse(raw);
}

/** Maps a mutation failure onto the one form-level message it implies. */
function reasonToFormError(
  t: Translate,
  reason: MutationFailureReason,
): string {
  switch (reason) {
    case "NOT_FOUND":
      return t("notFound");
    case "INVALID_CATEGORY":
      return t("categoryRequired");
    case "INVALID_REFERENCE":
      return t("invalidReference");
    case "SEQUENCE_EXHAUSTED":
      return t("sequenceExhausted");
    case "STATUS_LOCKED_BY_LOAN":
      return t("statusLockedByLoan");
    case "STATUS_SET_BY_LOAN":
      return t("statusSetByLoan");
    default:
      return t("unexpectedError");
  }
}

function toFailureState(t: Translate, reason: MutationFailureReason) {
  return {
    fieldErrors: {},
    formError: reasonToFormError(t, reason),
    isSuccess: false,
  };
}

/**
 * Creates an asset. Both identifiers are generated server-side inside
 * `createAsset` — the form never submits an `assetCode` or a `qrToken`, so
 * there is nothing here for a bypassed client to forge.
 */
export async function createAssetAction(
  _previousState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const user = await requireUser();
  const t = await getTranslations("AssetsPage");
  const parsed = parseAssetForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await createAsset(parsed.data, user.id);
  if (!result.ok) {
    return toFailureState(t, result.reason);
  }

  revalidatePath(ASSETS_PATH);
  redirect(ASSETS_PATH);
}

/**
 * Updates an asset. `assetCode` is deliberately absent from the submission:
 * it is immutable once issued (see `findAssetForEdit` in `queries.ts`), so
 * changing the category or the acquisition year corrects the record without
 * renumbering the label already stuck to the item.
 */
export async function updateAssetAction(
  _previousState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const user = await requireUser();
  const t = await getTranslations("AssetsPage");
  const id = assetIdSchema.parse(formData.get("id"));
  const parsed = parseAssetForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await updateAsset(id, parsed.data, user.id);
  if (!result.ok) {
    return toFailureState(t, result.reason);
  }

  revalidatePath(ASSETS_PATH);
  redirect(ASSETS_PATH);
}

/** Soft-deletes an asset behind the confirmation step `DeleteControl`
 * renders (PRD FR-2.5). */
export async function deleteAssetAction(
  _previousState: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const user = await requireUser();
  const t = await getTranslations("AssetsPage");
  const id = assetIdSchema.parse(formData.get("id"));

  const result = await softDeleteAsset(id, user.id);
  if (!result.ok) {
    return { formError: reasonToFormError(t, result.reason) };
  }

  revalidatePath(ASSETS_PATH);
  return INITIAL_DELETE_STATE;
}
