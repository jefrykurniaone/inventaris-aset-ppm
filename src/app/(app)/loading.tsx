import { getTranslations } from "next-intl/server";

import { Skeleton } from "@/components/ui/skeleton";

const STAT_CARD_KEYS = ["primary", "secondary", "status", "attention"] as const;
const CHART_ROW_KEYS = ["row-1", "row-2", "row-3", "row-4", "row-5"] as const;

function StatCardSkeleton() {
  return (
    <div className="border-border bg-background flex flex-col gap-1 rounded-lg border p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-16" />
    </div>
  );
}

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STAT_CARD_KEYS.map((key) => (
        <StatCardSkeleton key={key} />
      ))}
    </div>
  );
}

function OverdueLoansCardSkeleton() {
  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-14" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="border-border bg-background flex flex-col gap-3 rounded-lg border p-4">
      <Skeleton className="h-4 w-36" />
      <div className="flex flex-col gap-3">
        {CHART_ROW_KEYS.map((key) => (
          <Skeleton key={key} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Route-level Suspense fallback for the dashboard (ticket #84, PRD FR-9.1/
 * FR-9.2): shown the instant navigation to `/` starts, replaced once
 * `HomePage` (`./page.tsx`) finishes its data fetch. Mirrors that page's
 * grid shapes — `DashboardSummaryCards`, `OverdueLoansCard`,
 * `DashboardBarChart` — closely enough that arrival does not visibly reflow
 * the layout. A server component, like every other file in this route
 * group, so no client bundle is spent on a fallback that is never
 * interactive.
 *
 * Next.js also falls back to this file for any other `(app)` route that
 * defines no `loading.tsx` of its own (`/loans`, `/admin/*`) — a generic
 * fallback beats the frozen screen this ticket exists to fix, even where the
 * shape does not match as closely as it does here and at
 * `./assets/loading.tsx`, which overrides it for the asset list.
 */
export default async function DashboardLoading() {
  const t = await getTranslations("DashboardPage");

  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <SummaryCardsSkeleton />
      <OverdueLoansCardSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <span role="status" className="sr-only">
        {t("loadingLabel")}
      </span>
    </div>
  );
}
