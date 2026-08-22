import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DeleteControl } from "@/components/DeleteControl";
import { Button } from "@/components/ui/button";

import { deleteAssetAction } from "./actions";
import { CONDITION_LABEL_KEYS, STATUS_LABEL_KEYS } from "./asset-field-specs";
import { AssetRowCheckbox } from "./AssetRowCheckbox";
import { AssetThumbnail } from "./AssetThumbnail";
import type { AssetListRow } from "./list-queries";

type AssetsT = Awaited<ReturnType<typeof getTranslations<"AssetsPage">>>;

interface AssetCardProps {
  readonly asset: AssetListRow;
  readonly t: AssetsT;
}

/** The category/room/status/condition/year block, split out of `AssetCard`
 * so that component's own body stays under the project's 40-line limit. */
function AssetCardDetails({ asset, t }: Readonly<AssetCardProps>) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">{t("columnCategory")}</dt>
      <dd>{asset.categoryName}</dd>
      <dt className="text-muted-foreground">{t("columnRoom")}</dt>
      <dd>{`${asset.buildingName} — ${asset.roomName}`}</dd>
      <dt className="text-muted-foreground">{t("columnStatus")}</dt>
      <dd>{t(STATUS_LABEL_KEYS[asset.status])}</dd>
      <dt className="text-muted-foreground">{t("columnCondition")}</dt>
      <dd>{t(CONDITION_LABEL_KEYS[asset.condition])}</dd>
      <dt className="text-muted-foreground">
        {t("filterAcquisitionYearLabel")}
      </dt>
      <dd>{asset.acquisitionYear}</dd>
    </dl>
  );
}

/** The edit and delete controls, same split reason as `AssetCardDetails`. */
function AssetCardActions({ asset, t }: Readonly<AssetCardProps>) {
  return (
    <div className="flex justify-end gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/assets/${asset.id}/edit`}>{t("edit")}</Link>
      </Button>
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
    </div>
  );
}

/**
 * One asset, laid out for a phone-width viewport (PRD FR-2.6: "a readable
 * card layout on a phone"). Same row data as `AssetRow`, so the two never
 * drift — only the layout differs. `AssetTable` shows this list below `md`
 * and the `<table>` at `md` and above, in CSS, so no client-side breakpoint
 * detection is needed and nothing here risks a server/client render
 * mismatch.
 */
export function AssetCard({ asset, t }: Readonly<AssetCardProps>) {
  return (
    <li className="border-border flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-start gap-3">
        <AssetRowCheckbox assetId={asset.id} assetCode={asset.assetCode} />
        <AssetThumbnail
          thumbnailUrl={asset.thumbnailUrl}
          alt={t("thumbnailAlt", {
            assetName: asset.name,
            categoryName: asset.categoryName,
          })}
          placeholderLabel={t("thumbnailPlaceholderLabel", {
            assetName: asset.name,
          })}
        />
        <Link
          href={`/assets/${asset.id}`}
          className="flex flex-col hover:underline"
        >
          <span className="font-mono text-sm">{asset.assetCode}</span>
          <span className="font-medium">{asset.name}</span>
        </Link>
      </div>
      <AssetCardDetails asset={asset} t={t} />
      <AssetCardActions asset={asset} t={t} />
    </li>
  );
}
