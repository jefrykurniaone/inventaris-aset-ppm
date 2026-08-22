"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { useAssetSelection } from "./asset-selection-context";

/**
 * The selection count and its actions (PRD FR-2.6: "a persistent selection
 * count and a 'print labels' action that hands the selection to the label
 * view from #12"). #12 has not merged, so "Cetak label" links to a stub
 * route at `/assets/labels` rather than a real print view — see that
 * route's own comment.
 */
export function AssetSelectionToolbar() {
  const t = useTranslations("AssetsPage");
  const { selectedIds, clear } = useAssetSelection();
  const count = selectedIds.size;
  const labelsHref = `/assets/labels?ids=${[...selectedIds].join(",")}`;

  return (
    <div
      className="border-border flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
      aria-live="polite"
    >
      <span>{t("selectionCount", { count })}</span>
      <div className="flex gap-2">
        {count === 0 ? (
          <Button size="sm" variant="outline" disabled>
            {t("printLabels")}
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href={labelsHref}>{t("printLabels")}</Link>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={clear}
          disabled={count === 0}
        >
          {t("clearSelection")}
        </Button>
      </div>
    </div>
  );
}
