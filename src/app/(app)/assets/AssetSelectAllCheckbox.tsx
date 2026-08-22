"use client";

import { useTranslations } from "next-intl";

import { useAssetSelection } from "./asset-selection-context";

interface AssetSelectAllCheckboxProps {
  readonly pageAssetIds: readonly string[];
}

/** Selects or clears every row on the current page (PRD FR-2.6). Indeterminate
 * when some, but not all, of this page's rows are already selected — a plain
 * DOM property with no ARIA equivalent, so it is set imperatively via the
 * ref rather than as a JSX attribute. */
export function AssetSelectAllCheckbox({
  pageAssetIds,
}: Readonly<AssetSelectAllCheckboxProps>) {
  const t = useTranslations("AssetsPage");
  const { selectedIds, setMany } = useAssetSelection();

  const selectedOnPage = pageAssetIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const isAllSelected =
    pageAssetIds.length > 0 && selectedOnPage === pageAssetIds.length;
  const isIndeterminate = selectedOnPage > 0 && !isAllSelected;

  return (
    <input
      type="checkbox"
      checked={isAllSelected}
      disabled={pageAssetIds.length === 0}
      ref={(node) => {
        if (node) {
          node.indeterminate = isIndeterminate;
        }
      }}
      onChange={() => setMany(pageAssetIds, !isAllSelected)}
      aria-label={t("selectAllLabel")}
      className="h-4 w-4 rounded border-input"
    />
  );
}
