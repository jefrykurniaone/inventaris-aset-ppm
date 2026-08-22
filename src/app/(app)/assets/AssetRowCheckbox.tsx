"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { useAssetSelection } from "./asset-selection-context";

interface AssetRowCheckboxProps {
  readonly assetId: string;
  readonly assetCode: string;
}

/** One row's selection checkbox (PRD FR-2.6: row multi-select). A native
 * `<input type="checkbox">`, so it is keyboard-operable — spacebar toggles,
 * Tab reaches it — for free, with no ARIA role standing in for it. */
export function AssetRowCheckbox({
  assetId,
  assetCode,
}: Readonly<AssetRowCheckboxProps>) {
  const t = useTranslations("AssetsPage");
  const { selectedIds, toggle } = useAssetSelection();
  const id = useId();

  return (
    <input
      id={id}
      type="checkbox"
      checked={selectedIds.has(assetId)}
      onChange={() => toggle(assetId)}
      aria-label={t("selectRowLabel", { assetCode })}
      className="h-4 w-4 rounded border-input"
    />
  );
}
