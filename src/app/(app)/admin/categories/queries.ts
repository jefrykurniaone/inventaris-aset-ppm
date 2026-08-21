import { db } from "@/lib/db";

/**
 * One row of the category list. A plain interface, not a re-export of a
 * Prisma-generated type: `db` is the only import from the Prisma layer this
 * file needs, and mapping the query result into this shape keeps every
 * other module in this feature independent of the generated client's exact
 * payload shape for an `include`.
 */
export interface CategoryListRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly nameEn: string;
  readonly isActive: boolean;
  readonly assetCount: number;
}

/**
 * Lists every category with its live asset-reference count (PRD FR-3.4),
 * used both to render the list and to decide whether a row's delete control
 * is offered at all — a decision this read is allowed to go stale on, since
 * `deleteCategory` (`mutations.ts`) re-checks atomically at delete time.
 */
export async function listCategories(): Promise<readonly CategoryListRow[]> {
  const categories = await db.category.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { assets: true } } },
  });

  return categories.map((category) => ({
    id: category.id,
    code: category.code,
    name: category.name,
    nameEn: category.nameEn,
    isActive: category.isActive,
    assetCount: category._count.assets,
  }));
}
