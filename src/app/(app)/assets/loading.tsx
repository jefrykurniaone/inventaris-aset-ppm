import { getTranslations } from "next-intl/server";

import { Skeleton } from "@/components/ui/skeleton";

/** One per field `AssetFilters` renders: the search box, the six
 * spec-driven selects, the acquisition-year box, and the three sort
 * controls — see `AssetFilterInputs`/`AssetSortControls`. The key names
 * carry no meaning beyond being stable and distinct, the same reason
 * `AssetTable`'s `COLUMN_KEYS` is a literal list rather than an array
 * index. */
const FILTER_FIELD_KEYS = [
  "q",
  "categoryId",
  "buildingId",
  "roomId",
  "status",
  "condition",
  "fundingSourceId",
  "acquisitionYear",
  "sort",
  "dir",
  "pageSize",
] as const;

const TABLE_ROW_KEYS = [
  "row-1",
  "row-2",
  "row-3",
  "row-4",
  "row-5",
  "row-6",
] as const;

/** One column per `COLUMN_KEYS` entry in `AssetTable`, plus the leading
 * select-all checkbox column. */
const TABLE_COLUMN_KEYS = [
  "select",
  "thumbnail",
  "assetCode",
  "name",
  "category",
  "room",
  "status",
  "condition",
  "acquisitionYear",
  "edit",
  "delete",
] as const;

function FilterFieldSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FILTER_FIELD_KEYS.map((key) => (
        <FilterFieldSkeleton key={key} />
      ))}
      <div className="flex items-end gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

function TableHeaderSkeleton() {
  return (
    <div className="border-border flex gap-4 border-b py-2">
      {TABLE_COLUMN_KEYS.map((key) => (
        <Skeleton key={key} className="h-4 w-16 shrink-0" />
      ))}
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex gap-4 py-3">
      {TABLE_COLUMN_KEYS.map((key) => (
        <Skeleton key={key} className="h-8 w-16 shrink-0" />
      ))}
    </div>
  );
}

/** The `md:table` half of `AssetTable` — same breakpoint, so the skeleton
 * disappears at the same width the real table does, rather than mismatching
 * it for a moment. */
function TableSkeletonDesktop() {
  return (
    <div className="hidden overflow-x-auto md:block">
      <TableHeaderSkeleton />
      {TABLE_ROW_KEYS.map((key) => (
        <TableRowSkeleton key={key} />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="border-border flex gap-3 rounded-lg border p-3">
      <Skeleton className="h-16 w-16 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

/** The `md:hidden` card list `AssetTable` swaps in below that same
 * breakpoint. */
function TableSkeletonMobile() {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {TABLE_ROW_KEYS.map((key) => (
        <li key={key}>
          <CardSkeleton />
        </li>
      ))}
    </ul>
  );
}

function PaginationSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Skeleton className="h-4 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

/**
 * Route-level Suspense fallback for the asset register (ticket #84, PRD
 * FR-2.6): shown the instant navigation to `/assets` starts, replaced once
 * `AssetsPage` (`./page.tsx`) finishes its data fetch. Mirrors that page's
 * heading, `AssetFilters` grid, `AssetTable` (both its `md:table` and
 * `md:hidden` card layouts) and `AssetPagination` shapes closely enough that
 * arrival does not visibly reflow the layout.
 *
 * Also the fallback for `/assets`'s own child routes that define no
 * `loading.tsx` of their own (`/assets/new`, `/assets/[id]`, and so on) —
 * out of this ticket's scope to give each of those its own shape, and a
 * plausible fallback here still beats the frozen screen this ticket exists
 * to fix.
 */
export default async function AssetsLoading() {
  const t = await getTranslations("AssetsPage");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-8 w-24" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <FiltersSkeleton />
      <TableSkeletonDesktop />
      <TableSkeletonMobile />
      <PaginationSkeleton />
      <span role="status" className="sr-only">
        {t("loadingLabel")}
      </span>
    </div>
  );
}
