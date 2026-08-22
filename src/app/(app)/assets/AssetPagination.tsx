import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  withAssetListPage,
  type AssetListUrlState,
} from "@/lib/asset-list-url";
import { ASSETS_PATH } from "@/lib/paths";

import type { AssetsTranslate } from "./asset-field-specs";

interface AssetPaginationProps {
  readonly urlState: AssetListUrlState;
  readonly page: number;
  readonly pageCount: number;
  readonly totalCount: number;
  readonly t: AssetsTranslate;
}

/** One direction's control: a real link when that direction is reachable,
 * a real disabled `<button>` — never a disabled-looking link — otherwise,
 * so a screen reader and a keyboard both see it as unavailable. */
function AssetPaginationLink({
  href,
  label,
  isEnabled,
}: Readonly<{ href: string; label: string; isEnabled: boolean }>) {
  if (!isEnabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>{label}</Link>
    </Button>
  );
}

/** The asset list's pager (PRD FR-2.6: "it is paginated"). Renders nothing
 * once there is nothing to page through, which is also what keeps the empty
 * states in `AssetTable` free of a stray "page 1 of 1" underneath them. */
export function AssetPagination({
  urlState,
  page,
  pageCount,
  totalCount,
  t,
}: Readonly<AssetPaginationProps>) {
  if (totalCount === 0) {
    return null;
  }

  const previousHref = `${ASSETS_PATH}?${withAssetListPage(urlState, page - 1)}`;
  const nextHref = `${ASSETS_PATH}?${withAssetListPage(urlState, page + 1)}`;

  return (
    <nav
      aria-label={t("paginationLabel")}
      className="flex flex-wrap items-center justify-between gap-4 text-sm"
    >
      <p className="text-muted-foreground">
        {t("paginationSummary", { page, pageCount, totalCount })}
      </p>
      <div className="flex gap-2">
        <AssetPaginationLink
          href={previousHref}
          label={t("paginationPrevious")}
          isEnabled={page > 1}
        />
        <AssetPaginationLink
          href={nextHref}
          label={t("paginationNext")}
          isEnabled={page < pageCount}
        />
      </div>
    </nav>
  );
}
