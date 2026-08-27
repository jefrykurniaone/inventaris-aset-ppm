import { getTranslations } from "next-intl/server";

import type { TableColumnSpec } from "@/components/table-columns";
import { TableHeaderCells } from "@/components/TableHeaderCells";
import type { Locale } from "@/i18n/config";
import type { AssetListSortKey } from "@/lib/asset-list-query";
import {
  withAssetListSort,
  type AssetListUrlState,
} from "@/lib/asset-list-url";
import { ASSETS_PATH } from "@/lib/paths";
import type { SortDirection } from "@/lib/table-sort";

import { AssetCard } from "./AssetCard";
import type { AssetsPlainMessageKey } from "./asset-field-specs";
import { AssetRow } from "./AssetRow";
import { AssetSelectAllCheckbox } from "./AssetSelectAllCheckbox";
import type { AssetListRow } from "./list-queries";

type AssetsT = Awaited<ReturnType<typeof getTranslations<"AssetsPage">>>;

interface AssetTableProps {
  readonly assets: readonly AssetListRow[];
  readonly urlState: AssetListUrlState;
  readonly locale: Locale;
  readonly t: AssetsT;
  /** Distinguishes the register's two empty states (PRD FR-2.6): an empty
   * register reads "no assets yet", a search or filter with no matches reads
   * "no results for these filters" — the same zero rows, two different
   * messages, so a user does not read "nothing has ever been registered"
   * when they have simply filtered too narrowly. */
  readonly isFilteredView: boolean;
}

interface AssetColumn {
  readonly id: string;
  readonly labelKey: AssetsPlainMessageKey;
  readonly sortKey?: AssetListSortKey;
  readonly initialDirection?: SortDirection;
}

/**
 * The register's columns, and which of them sort (issue #87). The curated
 * set is the identity code, the name, the acquisition year and the
 * registration time; the photo and the two action columns deliberately carry
 * no `sortKey`, and neither do the columns whose value is a joined name.
 */
const ASSET_COLUMNS: readonly AssetColumn[] = [
  { id: "thumbnail", labelKey: "columnThumbnail" },
  { id: "assetCode", labelKey: "columnAssetCode", sortKey: "assetCode" },
  { id: "name", labelKey: "columnName", sortKey: "name" },
  { id: "category", labelKey: "columnCategory" },
  { id: "room", labelKey: "columnRoom" },
  { id: "status", labelKey: "columnStatus" },
  { id: "condition", labelKey: "columnCondition" },
  {
    id: "acquisitionYear",
    labelKey: "filterAcquisitionYearLabel",
    sortKey: "acquisitionYear",
    initialDirection: "desc",
  },
  {
    id: "createdAt",
    labelKey: "columnCreatedAt",
    sortKey: "createdAt",
    initialDirection: "desc",
  },
  { id: "edit", labelKey: "columnEdit" },
  { id: "delete", labelKey: "columnDelete" },
];

function toColumnSpecs(
  t: AssetsT,
): readonly TableColumnSpec<AssetListSortKey>[] {
  return ASSET_COLUMNS.map((column) => ({
    id: column.id,
    label: t(column.labelKey),
    sortKey: column.sortKey,
    initialDirection: column.initialDirection,
  }));
}

/**
 * The asset list (PRD FR-2.6). A `<table>` at `md` and above, and a list of
 * cards below it — both rendered from the same rows, switched by CSS
 * (`hidden md:table` / `md:hidden`) rather than by a client-side breakpoint
 * check, so there is no hydration mismatch and no horizontal page scroll on
 * a phone-width viewport.
 */
export function AssetTable({
  assets,
  urlState,
  locale,
  t,
  isFilteredView,
}: Readonly<AssetTableProps>) {
  if (assets.length === 0) {
    const emptyStateKey = isFilteredView ? "emptyStateFiltered" : "emptyState";
    return <p className="text-muted-foreground text-sm">{t(emptyStateKey)}</p>;
  }

  const pageAssetIds = assets.map((asset) => asset.id);

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-2 pr-4 font-medium">
                <AssetSelectAllCheckbox pageAssetIds={pageAssetIds} />
              </th>
              <TableHeaderCells
                action={ASSETS_PATH}
                columns={toColumnSpecs(t)}
                sortKey={urlState.sort}
                direction={urlState.dir}
                paramsFor={(sortKey, direction) =>
                  withAssetListSort(urlState, sortKey, direction)
                }
              />
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} locale={locale} t={t} />
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} locale={locale} t={t} />
        ))}
      </ul>
    </>
  );
}
