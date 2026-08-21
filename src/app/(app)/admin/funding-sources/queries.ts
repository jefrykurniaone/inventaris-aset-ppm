import { db } from "@/lib/db";

export interface FundingSourceListRow {
  readonly id: string;
  readonly name: string;
  readonly notes: string | null;
  readonly isActive: boolean;
  readonly assetCount: number;
}

/**
 * Lists every funding source with its live asset-reference count (PRD
 * FR-3.4). The render is allowed to go stale on that count —
 * `deleteFundingSource` (`mutations.ts`) re-checks atomically at delete time.
 */
export async function listFundingSources(): Promise<
  readonly FundingSourceListRow[]
> {
  const fundingSources = await db.fundingSource.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { assets: true } } },
  });

  return fundingSources.map((fundingSource) => ({
    id: fundingSource.id,
    name: fundingSource.name,
    notes: fundingSource.notes,
    isActive: fundingSource.isActive,
    assetCount: fundingSource._count.assets,
  }));
}
