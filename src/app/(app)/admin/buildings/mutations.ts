import { db } from "@/lib/db";
import {
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";

/**
 * Plain database logic for the `Building` master-data surface (PRD FR-3.1,
 * FR-3.3). Kept apart from `actions.ts` for the same reason as
 * `admin/categories/mutations.ts`: no dependency on `next/headers`, so
 * `scripts/verify-master-data-rules.ts` can call it directly against the
 * real development database.
 */

export interface BuildingInput {
  readonly code: string;
  readonly name: string;
}

export type MutationFailureReason =
  "NOT_FOUND" | "DUPLICATE_CODE" | "REFERENCED";

export type MutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: MutationFailureReason };

const OK: MutationResult = { ok: true };

export async function createBuilding(
  input: BuildingInput,
): Promise<MutationResult> {
  try {
    await db.building.create({ data: input });
    return OK;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "DUPLICATE_CODE" };
    }
    throw error;
  }
}

export async function updateBuilding(
  id: string,
  input: BuildingInput,
): Promise<MutationResult> {
  try {
    const updated = await db.building.updateMany({
      where: { id },
      data: input,
    });
    if (updated.count === 0) {
      return { ok: false, reason: "NOT_FOUND" };
    }
    return OK;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "DUPLICATE_CODE" };
    }
    throw error;
  }
}

/**
 * Deletes a building by attempting the delete directly. `Room.buildingId`
 * carries `onDelete: Restrict`, so any room under this building — whether
 * or not that room itself holds any asset — refuses the delete at the
 * database with `P2003`, mapped here to `REFERENCED` rather than a crash.
 * As with `deleteCategory`, this is one atomic operation rather than a
 * count-then-delete, so a room created after this building's row was
 * rendered still produces the same localised result.
 */
export async function deleteBuilding(id: string): Promise<MutationResult> {
  try {
    await db.building.delete({ where: { id } });
    return OK;
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      return { ok: false, reason: "REFERENCED" };
    }
    throw error;
  }
}

export async function setBuildingActive(
  id: string,
  isActive: boolean,
): Promise<MutationResult> {
  const updated = await db.building.updateMany({
    where: { id },
    data: { isActive },
  });
  return updated.count > 0 ? OK : { ok: false, reason: "NOT_FOUND" };
}
