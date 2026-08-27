import { db } from "@/lib/db";
import {
  buildMasterDataOrderBy,
  type FundingSourceSortKey,
  type MasterDataListParams,
} from "@/lib/master-data-list-query";
import { buildTablePageWindow } from "@/lib/table-sort";

export interface FundingSourceListRow {
  readonly id: string;
  readonly name: string;
  readonly notes: string | null;
  readonly isActive: boolean;
  readonly assetCount: number;
  readonly createdAt: Date;
}

export interface FundingSourceListPage {
  readonly rows: readonly FundingSourceListRow[];
  readonly totalCount: number;
}

/**
 * One page of funding sources with their live asset-reference counts (PRD
 * FR-3.4). The render is allowed to go stale on that count —
 * `deleteFundingSource` (`mutations.ts`) re-checks atomically at delete time.
 *
 * Sorted and paginated at the database since issue #87. The default is name
 * order rather than code order because a funding source has no code — `name`
 * is the unique column on this table.
 */
export async function listFundingSources(
  params: MasterDataListParams<FundingSourceSortKey>,
): Promise<FundingSourceListPage> {
  const { skip, take } = buildTablePageWindow(params.page, params.pageSize);

  const [fundingSources, totalCount] = await Promise.all([
    db.fundingSource.findMany({
      orderBy: buildMasterDataOrderBy(params.sort, params.dir),
      skip,
      take,
      include: { _count: { select: { assets: true } } },
    }),
    db.fundingSource.count(),
  ]);

  return {
    rows: fundingSources.map((fundingSource) => ({
      id: fundingSource.id,
      name: fundingSource.name,
      notes: fundingSource.notes,
      isActive: fundingSource.isActive,
      assetCount: fundingSource._count.assets,
      createdAt: fundingSource.createdAt,
    })),
    totalCount,
  };
}
