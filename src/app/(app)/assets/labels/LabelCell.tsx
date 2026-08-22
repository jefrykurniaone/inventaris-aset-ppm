import type { getTranslations } from "next-intl/server";

import { QrCode } from "@/components/QrCode";
import { computeLabelQrSizePx } from "@/lib/label-sheet";
import { buildScanUrl } from "@/lib/scan-url";

import type { LabelAssetRow } from "./queries";

type LabelsT = Awaited<ReturnType<typeof getTranslations<"AssetLabelsPage">>>;
type DetailT = Awaited<ReturnType<typeof getTranslations<"AssetDetailPage">>>;

interface LabelCellProps {
  /** `null` for a blank position from the starting offset (FR-5.4's "skip
   * the first N positions" control) — an already-used spot on a partly used
   * sheet, printed with nothing rather than a label. */
  readonly asset: LabelAssetRow | null;
  readonly t: LabelsT;
  readonly td: DetailT;
}

/** Derived once, from the module-level `LABEL_SHEET` default, rather than
 * per render: every label on every sheet is the same physical size. */
const LABEL_QR_SIZE_PX = computeLabelQrSizePx();

/**
 * One printed label (PRD FR-5.3): the QR code, the asset code as
 * human-readable text, a truncated asset name, and the organisation line. A
 * damaged or unscanned QR still leaves an identifiable label because the
 * asset code is printed as plain text beside it.
 */
export function LabelCell({ asset, t, td }: Readonly<LabelCellProps>) {
  if (!asset) {
    return <div className="label-cell" aria-hidden="true" />;
  }

  const scanUrl = buildScanUrl(asset.qrToken);

  return (
    <div className="label-cell">
      <QrCode
        value={scanUrl}
        sizePx={LABEL_QR_SIZE_PX}
        label={td("qrCodeAlt", { assetCode: asset.assetCode })}
      />
      <span className="font-mono text-[2.2mm] leading-tight">
        {asset.assetCode}
      </span>
      <span className="w-full truncate text-[2mm] leading-tight">
        {asset.name}
      </span>
      <span className="text-[1.8mm] leading-tight">{t("organisation")}</span>
    </div>
  );
}
