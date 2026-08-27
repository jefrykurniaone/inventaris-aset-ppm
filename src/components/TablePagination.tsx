import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

interface TablePaginationProps {
  readonly action: string;
  /** The current view without `page` — every filter, the sort and the page
   * size, carried forward onto whichever page the reader goes to. */
  readonly params: URLSearchParams;
  readonly page: number;
  readonly pageCount: number;
  readonly totalCount: number;
}

/** A real link when that direction is reachable, a real disabled `<button>` —
 * never a disabled-looking link — otherwise, so a screen reader and a
 * keyboard both see it as unavailable. The same construction
 * `AssetPagination` and `LoanPagination` already use. */
function TablePaginationLink({
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

function hrefForPage(
  action: string,
  params: URLSearchParams,
  page: number,
): string {
  const target = new URLSearchParams(params);
  target.set("page", String(page));
  return `${action}?${target.toString()}`;
}

/**
 * The pager the admin master-data lists and the user list gained with issue
 * #87. Renders nothing once there is nothing to page through, which keeps a
 * stray "page 1 of 1" from appearing under an empty state.
 *
 * The asset and loan lists keep their own pagers: each carries a summary
 * counted in its own noun ("42 assets", "42 loans") rather than in rows.
 */
export async function TablePagination({
  action,
  params,
  page,
  pageCount,
  totalCount,
}: Readonly<TablePaginationProps>) {
  if (totalCount === 0) {
    return null;
  }

  const t = await getTranslations("TableControls");

  return (
    <nav
      aria-label={t("paginationLabel")}
      className="flex flex-wrap items-center justify-between gap-4 text-sm"
    >
      <p className="text-muted-foreground">
        {t("paginationSummary", { page, pageCount, totalCount })}
      </p>
      <div className="flex gap-2">
        <TablePaginationLink
          href={hrefForPage(action, params, page - 1)}
          label={t("paginationPrevious")}
          isEnabled={page > 1}
        />
        <TablePaginationLink
          href={hrefForPage(action, params, page + 1)}
          label={t("paginationNext")}
          isEnabled={page < pageCount}
        />
      </div>
    </nav>
  );
}
