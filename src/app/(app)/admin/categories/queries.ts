import { db } from "@/lib/db";
import {
  buildMasterDataOrderBy,
  type MasterDataListParams,
  type MasterDataSortKey,
} from "@/lib/master-data-list-query";
import { buildTablePageWindow } from "@/lib/table-sort";

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
  readonly createdAt: Date;
}

export interface CategoryListPage {
  readonly rows: readonly CategoryListRow[];
  readonly totalCount: number;
}

/**
 * One page of categories with their live asset-reference counts (PRD
 * FR-3.4), used both to render the list and to decide whether a row's delete
 * control is offered at all — a decision this read is allowed to go stale on,
 * since `deleteCategory` (`mutations.ts`) re-checks atomically at delete
 * time.
 *
 * Sorted and paginated at the database since issue #87.
 */
export async function listCategories(
  params: MasterDataListParams<MasterDataSortKey>,
): Promise<CategoryListPage> {
  const { skip, take } = buildTablePageWindow(params.page, params.pageSize);

  const [categories, totalCount] = await Promise.all([
    db.category.findMany({
      orderBy: buildMasterDataOrderBy(params.sort, params.dir),
      skip,
      take,
      include: { _count: { select: { assets: true } } },
    }),
    db.category.count(),
  ]);

  return {
    rows: categories.map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
      nameEn: category.nameEn,
      isActive: category.isActive,
      assetCount: category._count.assets,
      createdAt: category.createdAt,
    })),
    totalCount,
  };
}
