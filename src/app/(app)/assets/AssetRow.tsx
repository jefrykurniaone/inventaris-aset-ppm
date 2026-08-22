import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DeleteControl } from "@/components/DeleteControl";
import { Button } from "@/components/ui/button";

import { deleteAssetAction } from "./actions";
import { CONDITION_LABEL_KEYS, STATUS_LABEL_KEYS } from "./asset-field-specs";
import { AssetRowCheckbox } from "./AssetRowCheckbox";
import { AssetThumbnailPlaceholder } from "./AssetThumbnailPlaceholder";
import type { AssetListRow } from "./list-queries";

type AssetsT = Awaited<ReturnType<typeof getTranslations<"AssetsPage">>>;

interface AssetRowProps {
  readonly asset: AssetListRow;
  readonly t: AssetsT;
}

/** One row of the asset list's desktop table, split out of `AssetTable` so
 * every function in this feature stays under the project's 40-line limit.
 * `AssetCard` is this same row's data, laid out for a phone. */
export function AssetRow({ asset, t }: Readonly<AssetRowProps>) {
  return (
    <tr className="border-border border-b align-top">
      <td className="py-2 pr-4">
        <AssetRowCheckbox assetId={asset.id} assetCode={asset.assetCode} />
      </td>
      <td className="py-2 pr-4">
        <AssetThumbnailPlaceholder
          label={t("thumbnailPlaceholderLabel", { assetName: asset.name })}
        />
      </td>
      <td className="py-2 pr-4 font-mono whitespace-nowrap">
        <Link href={`/assets/${asset.id}`} className="hover:underline">
          {asset.assetCode}
        </Link>
      </td>
      <td className="py-2 pr-4">
        <Link href={`/assets/${asset.id}`} className="hover:underline">
          {asset.name}
        </Link>
      </td>
      <td className="py-2 pr-4">{asset.categoryName}</td>
      <td className="py-2 pr-4">{`${asset.buildingName} — ${asset.roomName}`}</td>
      <td className="py-2 pr-4">{t(STATUS_LABEL_KEYS[asset.status])}</td>
      <td className="py-2 pr-4">{t(CONDITION_LABEL_KEYS[asset.condition])}</td>
      <td className="py-2 pr-4">{asset.acquisitionYear}</td>
      <td className="py-2 pr-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/assets/${asset.id}/edit`}>{t("edit")}</Link>
        </Button>
      </td>
      <td className="py-2">
        <DeleteControl
          action={deleteAssetAction}
          id={asset.id}
          triggerLabel={t("delete")}
          pendingLabel={t("deletePending")}
          title={t("deleteConfirmTitle", { assetCode: asset.assetCode })}
          description={t("deleteConfirmDescription")}
          cancelLabel={t("cancel")}
          confirmLabel={t("deleteConfirm")}
        />
      </td>
    </tr>
  );
}
