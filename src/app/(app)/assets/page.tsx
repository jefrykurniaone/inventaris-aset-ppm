import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { TablePageSizeSelect } from "@/components/TablePageSizeSelect";
import { Button } from "@/components/ui/button";
import { buildAssetExportHref } from "@/lib/asset-export";
import {
  totalAssetListPageCount,
  type AssetListQueryInput,
} from "@/lib/asset-list-query";
import { buildAssetListParamsWithoutPageSize } from "@/lib/asset-list-url";
import { ASSETS_PATH, NEW_ASSET_PATH } from "@/lib/paths";
import { requireUser } from "@/lib/require-user";

import { AssetFilters } from "./AssetFilters";
import { AssetPagination } from "./AssetPagination";
import { AssetSelectionProvider } from "./asset-selection-context";
import { AssetSelectionToolbar } from "./AssetSelectionToolbar";
import { AssetTable } from "./AssetTable";
import {
  assetListSearchParamsSchema,
  type AssetListSearchParams,
} from "./list-schemas";
import { listAssetFilterOptions, listAssetsPage } from "./list-queries";

interface AssetsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Whether any filter or search term is active — the page-1 overflow case
 * (a page number past the last page, with no filter at all) reads the same
 * way, since both mean "these criteria, not the whole register, produced
 * zero rows". */
function isFilteredView(params: AssetListSearchParams): boolean {
  const hasFilter = Boolean(
    params.q ||
    params.categoryId ||
    params.buildingId ||
    params.roomId ||
    params.status ||
    params.condition ||
    params.acquisitionYear ||
    params.fundingSourceId ||
    params.attention ||
    params.noPhoto,
  );
  return hasFilter || params.page > 1;
}

/** `AssetListSearchParams` and `AssetListQueryInput` name a few fields
 * differently (`q`/`sort`/`dir` versus `search`/`sortKey`/`sortDirection`) —
 * this is the one place that seam is bridged, so `AssetsPage` itself stays a
 * plain list of calls. `AssetListUrlState` (`AssetPagination`,
 * `AssetSortControls`'s form) needs no such bridge: it is field-for-field
 * the same shape as `AssetListSearchParams`, so `params` is passed there
 * directly. */
function toAssetListQueryInput(
  params: AssetListSearchParams,
): AssetListQueryInput {
  return {
    search: params.q,
    categoryId: params.categoryId,
    buildingId: params.buildingId,
    roomId: params.roomId,
    status: params.status,
    condition: params.condition,
    acquisitionYear: params.acquisitionYear,
    fundingSourceId: params.fundingSourceId,
    attention: params.attention,
    noPhoto: params.noPhoto,
    sortKey: params.sort,
    sortDirection: params.dir,
    page: params.page,
    pageSize: params.pageSize,
  };
}

/**
 * The asset register index (PRD FR-2.6): free-text search, six filters,
 * sorting, server-side pagination and row multi-select. Replaces the
 * deliberately minimal index #7 shipped — see that ticket's completion
 * record on issue #7 for why it existed at all.
 */
export default async function AssetsPage({
  searchParams,
}: Readonly<AssetsPageProps>) {
  await requireUser();
  const [locale, t, tExport] = await Promise.all([
    getLocale(),
    getTranslations("AssetsPage"),
    getTranslations("AssetExport"),
  ]);
  const params = assetListSearchParamsSchema.parse(await searchParams);

  const [{ rows, totalCount }, filterOptions] = await Promise.all([
    listAssetsPage(toAssetListQueryInput(params)),
    listAssetFilterOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* A plain anchor, not `next/link`: the target is a route handler
              that generates a file, and a prefetch of it would build a whole
              workbook nobody asked for. The href carries the list's current
              filters and sort, so the download matches what is on screen. */}
          <Button asChild variant="outline">
            <a href={buildAssetExportHref(params)}>{tExport("triggerLabel")}</a>
          </Button>
          <Button asChild>
            <Link href={NEW_ASSET_PATH}>{t("createLink")}</Link>
          </Button>
        </div>
      </div>
      <AssetFilters params={params} options={filterOptions} t={t} />
      <AssetSelectionProvider>
        <AssetSelectionToolbar />
        <AssetTable
          assets={rows}
          urlState={params}
          locale={locale}
          t={t}
          isFilteredView={isFilteredView(params)}
        />
      </AssetSelectionProvider>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <TablePageSizeSelect
          action={ASSETS_PATH}
          params={buildAssetListParamsWithoutPageSize(params)}
          pageSize={params.pageSize}
          id="asset-list-page-size"
        />
        <AssetPagination
          urlState={params}
          page={params.page}
          pageCount={totalAssetListPageCount(totalCount, params.pageSize)}
          totalCount={totalCount}
          t={t}
        />
      </div>
    </div>
  );
}
