import { db } from "@/lib/db";
import {
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";

/**
 * Plain database logic for the `FundingSource` master-data surface (PRD
 * FR-3.1). Kept apart from `actions.ts` for the same reason as the other
 * three surfaces' `mutations.ts`: no dependency on `next/headers`.
 */

export interface FundingSourceInput {
  readonly name: string;
  readonly notes: string | null;
}

export type MutationFailureReason =
  "NOT_FOUND" | "DUPLICATE_NAME" | "REFERENCED";

export type MutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: MutationFailureReason };

const OK: MutationResult = { ok: true };

export async function createFundingSource(
  input: FundingSourceInput,
): Promise<MutationResult> {
  try {
    await db.fundingSource.create({ data: input });
    return OK;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "DUPLICATE_NAME" };
    }
    throw error;
  }
}

export async function updateFundingSource(
  id: string,
  input: FundingSourceInput,
): Promise<MutationResult> {
  try {
    const updated = await db.fundingSource.updateMany({
      where: { id },
      data: input,
    });
    if (updated.count === 0) {
      return { ok: false, reason: "NOT_FOUND" };
    }
    return OK;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "DUPLICATE_NAME" };
    }
    throw error;
  }
}

/**
 * Deletes a funding source by attempting the delete directly — one atomic
 * database operation, not a count-then-delete — so an asset assigned this
 * funding source after this row was rendered still produces this same
 * localised result instead of a raw `P2003` (PRD FR-3.4).
 */
export async function deleteFundingSource(id: string): Promise<MutationResult> {
  try {
    await db.fundingSource.delete({ where: { id } });
    return OK;
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      return { ok: false, reason: "REFERENCED" };
    }
    throw error;
  }
}

export async function setFundingSourceActive(
  id: string,
  isActive: boolean,
): Promise<MutationResult> {
  const updated = await db.fundingSource.updateMany({
    where: { id },
    data: { isActive },
  });
  return updated.count > 0 ? OK : { ok: false, reason: "NOT_FOUND" };
}
