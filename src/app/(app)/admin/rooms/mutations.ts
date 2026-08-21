import { db } from "@/lib/db";
import {
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";

/**
 * Plain database logic for the `Room` master-data surface (PRD FR-3.1,
 * FR-3.3). Kept apart from `actions.ts` for the same reason as the other
 * three surfaces' `mutations.ts`: no dependency on `next/headers`.
 */

export interface RoomInput {
  readonly buildingId: string;
  readonly code: string;
  readonly name: string;
}

export type MutationFailureReason =
  "NOT_FOUND" | "DUPLICATE_CODE" | "INVALID_BUILDING" | "REFERENCED";

export type MutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: MutationFailureReason };

const OK: MutationResult = { ok: true };

/**
 * A `P2003` on create/update means the submitted `buildingId` does not
 * exist — a different situation from `deleteRoom`'s `P2003`, which means
 * *this* room is referenced by an asset. Both are the same Prisma code; the
 * distinction comes from which relation is being written, not the code.
 */
export async function createRoom(input: RoomInput): Promise<MutationResult> {
  try {
    await db.room.create({ data: input });
    return OK;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "DUPLICATE_CODE" };
    }
    if (isForeignKeyConstraintError(error)) {
      return { ok: false, reason: "INVALID_BUILDING" };
    }
    throw error;
  }
}

export async function updateRoom(
  id: string,
  input: RoomInput,
): Promise<MutationResult> {
  try {
    const updated = await db.room.updateMany({ where: { id }, data: input });
    if (updated.count === 0) {
      return { ok: false, reason: "NOT_FOUND" };
    }
    return OK;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "DUPLICATE_CODE" };
    }
    if (isForeignKeyConstraintError(error)) {
      return { ok: false, reason: "INVALID_BUILDING" };
    }
    throw error;
  }
}

/**
 * Deletes a room by attempting the delete directly — one atomic database
 * operation, not a count-then-delete — so an asset moved into this room
 * after it was rendered still produces this same localised result instead
 * of a raw `P2003` (PRD FR-3.4).
 */
export async function deleteRoom(id: string): Promise<MutationResult> {
  try {
    await db.room.delete({ where: { id } });
    return OK;
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      return { ok: false, reason: "REFERENCED" };
    }
    throw error;
  }
}

export async function setRoomActive(
  id: string,
  isActive: boolean,
): Promise<MutationResult> {
  const updated = await db.room.updateMany({
    where: { id },
    data: { isActive },
  });
  return updated.count > 0 ? OK : { ok: false, reason: "NOT_FOUND" };
}
