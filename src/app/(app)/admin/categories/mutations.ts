import { db } from "@/lib/db";
import {
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";

/**
 * Plain database logic for the `Category` master-data surface (PRD FR-3.1,
 * FR-3.2, FR-3.4), kept apart from `actions.ts` so it never touches
 * `next/headers` — every function here is a plain `async` function with no
 * dependency on a Next.js request context, so `scripts/verify-master-data-rules.ts`
 * can exercise it directly against the real development database. The
 * `requireAdmin()` authorisation boundary lives in `actions.ts`, one layer up;
 * nothing in this file is reachable from a browser on its own.
 */

export interface CategoryInput {
  readonly code: string;
  readonly name: string;
  readonly nameEn: string;
}

export type MutationFailureReason =
  "NOT_FOUND" | "DUPLICATE_CODE" | "CODE_IMMUTABLE" | "REFERENCED";

export type MutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: MutationFailureReason };

const OK: MutationResult = { ok: true };

export async function createCategory(
  input: CategoryInput,
): Promise<MutationResult> {
  try {
    await db.category.create({ data: input });
    return OK;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "DUPLICATE_CODE" };
    }
    throw error;
  }
}

/** Counts every asset row referencing this category, soft-deleted included:
 * a soft-deleted `Asset` row still exists physically, so it still blocks a
 * database-level delete of the category it references, regardless of
 * whether the application considers it "deleted". */
async function countReferencingAssets(categoryId: string): Promise<number> {
  return db.asset.count({ where: { categoryId } });
}

/**
 * Updates a category, enforcing `code` immutability once any asset
 * references it (PRD FR-3.2's numbering scheme, and the ticket's explicit
 * rule): the check reads the real reference count rather than trusting that
 * the caller only submits an unchanged code because the form field was
 * disabled — the disabled input is a courtesy, this is the rule.
 */
export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<MutationResult> {
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const isCodeChanging = existing.code !== input.code;
  if (isCodeChanging && (await countReferencingAssets(id)) > 0) {
    return { ok: false, reason: "CODE_IMMUTABLE" };
  }

  try {
    await db.category.update({ where: { id }, data: input });
    return OK;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "DUPLICATE_CODE" };
    }
    throw error;
  }
}

/**
 * Deletes a category by attempting the delete directly — one atomic
 * database operation — rather than counting references and then deleting
 * as two separate steps. An asset created between a reference count read
 * and the delete would make the second step fail at the database with a raw
 * `P2003`; attempting the delete directly and mapping that failure here
 * turns the race into the same localised "still referenced" result the
 * up-front count already predicted for the common case.
 */
export async function deleteCategory(id: string): Promise<MutationResult> {
  try {
    await db.category.delete({ where: { id } });
    return OK;
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      return { ok: false, reason: "REFERENCED" };
    }
    throw error;
  }
}

export async function setCategoryActive(
  id: string,
  isActive: boolean,
): Promise<MutationResult> {
  const updated = await db.category.updateMany({
    where: { id },
    data: { isActive },
  });
  return updated.count > 0 ? OK : { ok: false, reason: "NOT_FOUND" };
}
