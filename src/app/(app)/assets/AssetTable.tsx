import { getTranslations } from "next-intl/server";

import { AssetRow } from "./AssetRow";
import type { AssetListRow } from "./queries";

type AssetsT = Awaited<ReturnType<typeof getTranslations<"AssetsPage">>>;

interface AssetTableProps {
  readonly assets: readonly AssetListRow[];
  readonly t: AssetsT;
}

const COLUMN_KEYS = [
  "columnAssetCode",
  "columnName",
  "columnCategory",
  "columnRoom",
  "columnStatus",
  "columnCondition",
  "columnEdit",
  "columnDelete",
] as const;

/** The plain asset list. Search, filters, pagination, sorting and selection
 * are #8's, not this table's — see the note at the top of `page.tsx`. */
export function AssetTable({ assets, t }: Readonly<AssetTableProps>) {
  if (assets.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("emptyState")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-border border-b">
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
  );
}
