import { getTranslations } from "next-intl/server";

import { AssetCard } from "./AssetCard";
import { AssetRow } from "./AssetRow";
import { AssetSelectAllCheckbox } from "./AssetSelectAllCheckbox";
import type { AssetListRow } from "./list-queries";

type AssetsT = Awaited<ReturnType<typeof getTranslations<"AssetsPage">>>;

interface AssetTableProps {
  readonly assets: readonly AssetListRow[];
  readonly t: AssetsT;
  /** Distinguishes the register's two empty states (PRD FR-2.6): an empty
   * register reads "no assets yet", a search or filter with no matches reads
   * "no results for these filters" — the same zero rows, two different
   * messages, so a user does not read "nothing has ever been registered"
   * when they have simply filtered too narrowly. */
  readonly isFilteredView: boolean;
}

const COLUMN_KEYS = [
  "columnThumbnail",
  "columnAssetCode",
  "columnName",
  "columnCategory",
  "columnRoom",
  "columnStatus",
  "columnCondition",
  "filterAcquisitionYearLabel",
  "columnEdit",
  "columnDelete",
] as const;

/**
 * The asset list (PRD FR-2.6). A `<table>` at `md` and above, and a list of
 * cards below it — both rendered from the same rows, switched by CSS
 * (`hidden md:table` / `md:hidden`) rather than by a client-side breakpoint
 * check, so there is no hydration mismatch and no horizontal page scroll on
 * a phone-width viewport.
 */
export function AssetTable({
  assets,
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
              {COLUMN_KEYS.map((key) => (
                <th key={key} scope="col" className="py-2 pr-4 font-medium">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} t={t} />
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} t={t} />
        ))}
      </ul>
    </>
  );
}
