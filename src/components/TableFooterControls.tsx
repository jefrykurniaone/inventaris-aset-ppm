import { TablePageSizeSelect } from "./TablePageSizeSelect";
import { TablePagination } from "./TablePagination";

interface TableFooterControlsProps {
  readonly action: string;
  /** The current view minus `pageSize` and `page` — the select supplies the
   * first and resetting the second is the point. */
  readonly pageSizeParams: URLSearchParams;
  /** The current view minus `page` — the pager supplies that itself. */
  readonly pagerParams: URLSearchParams;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly totalCount: number;
  /** Unique per table on the page: the page-size `<label>` points at it. */
  readonly pageSizeSelectId: string;
}

/**
 * The row under a list table: page size on the left, pager on the right.
 *
 * One component rather than the same eight lines on five admin pages — the
 * two controls have to agree about which params each carries, and that
 * agreement is easier to keep in one place than in five. The asset and loan
 * lists compose the same two controls by hand, because each keeps a pager
 * whose summary is counted in its own noun rather than in rows.
 */
export function TableFooterControls({
  action,
  pageSizeParams,
  pagerParams,
  page,
  pageSize,
  pageCount,
  totalCount,
  pageSizeSelectId,
}: Readonly<TableFooterControlsProps>) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <TablePageSizeSelect
        action={action}
        params={pageSizeParams}
        pageSize={pageSize}
        id={pageSizeSelectId}
      />
      <TablePagination
        action={action}
        params={pagerParams}
        page={page}
        pageCount={pageCount}
        totalCount={totalCount}
      />
    </div>
  );
}
