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
  createRoom,
  deleteRoom,
  setRoomActive,
  updateRoom,
  type MutationFailureReason,
} from "./mutations";
import {
  roomIdSchema,
  roomSchema,
  type RoomFieldErrors,
  type RoomFormState,
} from "./schemas";

const ROOMS_PATH = "/admin/rooms";

type Translate = Awaited<ReturnType<typeof getTranslations<"AdminRoomsPage">>>;

function logActionError(action: string, input: unknown, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `admin/rooms/actions.${action}: input=${JSON.stringify(input)} — ${message}`,
  );
}

type RoomFieldName = keyof RoomFieldErrors;

const FIELD_ERROR_KEYS: Record<RoomFieldName, Parameters<Translate>[0]> = {
  buildingId: "buildingRequired",
  code: "codeRequired",
  name: "nameRequired",
};

function isRoomFieldName(value: PropertyKey): value is RoomFieldName {
  return value === "buildingId" || value === "code" || value === "name";
}

function buildFieldErrors(
  t: Translate,
  issues: ReadonlyArray<{ path: PropertyKey[] }>,
): RoomFieldErrors {
  const fieldErrors: RoomFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isRoomFieldName(field)) {
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
    case "INVALID_BUILDING":
      return t("invalidBuilding");
    case "NOT_FOUND":
      return t("notFound");
    default:
      return t("unexpectedError");
  }
}

function parseRoomForm(formData: FormData) {
  return roomSchema.safeParse({
    buildingId: formData.get("buildingId"),
    code: formData.get("code"),
    name: formData.get("name"),
  });
}

/** Creates a room (PRD FR-3.1, FR-3.3). `requireAdmin()` is the first
 * statement — the boundary the "staff caller refused" test targets. */
export async function createRoomAction(
  _previousState: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  await requireAdmin();
  const t = await getTranslations("AdminRoomsPage");
  const parsed = parseRoomForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await createRoom(parsed.data);
  if (!result.ok) {
    return {
      fieldErrors: {},
      formError: reasonToFormError(t, result.reason),
      isSuccess: false,
    };
  }

  revalidatePath(ROOMS_PATH);
  return { fieldErrors: {}, formError: null, isSuccess: true };
}

export async function updateRoomAction(
  _previousState: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  await requireAdmin();
  const t = await getTranslations("AdminRoomsPage");
  const id = roomIdSchema.parse(formData.get("id"));
  const parsed = parseRoomForm(formData);

  if (!parsed.success) {
    return {
      fieldErrors: buildFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  const result = await updateRoom(id, parsed.data);
  if (!result.ok) {
    return {
      fieldErrors: {},
      formError: reasonToFormError(t, result.reason),
      isSuccess: false,
    };
  }

  revalidatePath(ROOMS_PATH);
  redirect(ROOMS_PATH);
}

/**
 * Deletes a room, or reports it is still referenced. `deleteRoom` attempts
 * the delete directly, so an asset moved into this room after it was
 * rendered still produces this same localised message rather than a crash.
 */
export async function deleteRoomAction(
  _previousState: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  await requireAdmin();
  const t = await getTranslations("AdminRoomsPage");
  const id = roomIdSchema.parse(formData.get("id"));

  const result = await deleteRoom(id);
  if (!result.ok) {
    const formError =
      result.reason === "REFERENCED"
        ? t("stillReferenced")
        : t("unexpectedError");
    return { formError };
  }

  revalidatePath(ROOMS_PATH);
  return INITIAL_DELETE_STATE;
}

/**
 * Shared body for deactivate/reactivate. Its own `requireAdmin()` call is
 * deliberately redundant with the one at the top of each exported action
 * below — a second session read, not a correctness problem, the same
 * belt-and-suspenders `src/app/(app)/admin/layout.tsx` and each server
 * action already apply together.
 */
async function setActiveAction(id: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  try {
    const result = await setRoomActive(id, isActive);
    if (!result.ok) {
      logActionError("setActiveAction", { id, isActive }, result.reason);
      return;
    }
  } catch (error) {
    logActionError("setActiveAction", { id, isActive }, error);
    return;
  }
  revalidatePath(ROOMS_PATH);
}

export async function deactivateRoomAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = roomIdSchema.parse(formData.get("id"));
  await setActiveAction(id, false);
}

export async function reactivateRoomAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = roomIdSchema.parse(formData.get("id"));
  await setActiveAction(id, true);
}
