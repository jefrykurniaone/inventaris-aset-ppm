import { getLocale, getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";
import { formatCurrencyIdr, formatInteger } from "@/lib/format-number";
import { requireUser } from "@/lib/require-user";
import { ADMIN_ROLE } from "@/lib/roles";

import { STATUS_LABEL_KEYS } from "./assets/asset-field-specs";
import {
  DashboardBarChart,
  type DashboardBarChartItem,
} from "./DashboardBarChart";
import { DashboardSummaryCards } from "./DashboardSummaryCards";
import { OverdueLoansCard } from "./loans/OverdueLoansCard";
import type { DashboardStatusRow } from "./DashboardStatusBreakdownCard";
import {
  acquisitionYearFilterHref,
  categoryFilterHref,
  statusFilterHref,
} from "./dashboard-links";
import {
  loadDashboardMetrics,
  type DashboardMetrics,
} from "./dashboard-queries";

type DashboardT = Awaited<ReturnType<typeof getTranslations<"DashboardPage">>>;
type AssetsT = Awaited<ReturnType<typeof getTranslations<"AssetsPage">>>;

function toStatusRows(
  metrics: DashboardMetrics,
  tAssets: AssetsT,
  locale: Locale,
): readonly DashboardStatusRow[] {
  return metrics.statusCounts.map((row) => ({
    key: row.status,
    label: tAssets(STATUS_LABEL_KEYS[row.status]),
    value: formatInteger(row.count, locale),
    href: statusFilterHref(row.status),
  }));
}

function toCategoryItems(
  metrics: DashboardMetrics,
  locale: Locale,
): readonly DashboardBarChartItem[] {
  return metrics.categoryCounts.map((row) => ({
    key: row.categoryId,
    label: row.categoryName,
    count: row.count,
    value: formatInteger(row.count, locale),
    href: categoryFilterHref(row.categoryId),
  }));
}

function toYearItems(
  metrics: DashboardMetrics,
  locale: Locale,
): readonly DashboardBarChartItem[] {
  return metrics.yearCounts.map((row) => ({
    key: String(row.year),
    label: String(row.year),
    count: row.count,
    value: formatInteger(row.count, locale),
    href: acquisitionYearFilterHref(row.year),
  }));
}

interface ChartsSectionProps {
  readonly metrics: DashboardMetrics;
  readonly locale: Locale;
  readonly t: DashboardT;
}

/** The two PRD FR-9.2 charts. Split out of `HomePage` so that function's own
 * body stays under the project's 40-line limit. */
function DashboardChartsSection({
  metrics,
  locale,
  t,
}: Readonly<ChartsSectionProps>) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DashboardBarChart
        headingId="dashboard-category-chart"
        title={t("categoryChartTitle")}
        items={toCategoryItems(metrics, locale)}
        emptyMessage={t("categoryChartEmpty")}
      />
      <DashboardBarChart
        headingId="dashboard-year-chart"
        title={t("yearChartTitle")}
        items={toYearItems(metrics, locale)}
        emptyMessage={t("yearChartEmpty")}
      />
    </div>
  );
}

/**
 * The landing page after sign-in (PRD FR-9.1, FR-9.2): four summary cards
 * and two charts, every figure read from an aggregate database query in
 * `dashboard-queries.ts`. Replaces the theme-demo placeholder that shipped
 * with the `(app)` route group scaffold (issue #1) — this is that
 * placeholder's real mount point.
 *
 * The total acquisition value is computed at all only when `isAdmin` is
 * true: `loadDashboardMetrics`'s `includeTotalValue` option is what keeps a
 * staff session's response payload from ever carrying that figure, not a
 * conditional render of an already-fetched number (PRD FR-9.1: "admin only").
 *
 * `OverdueLoansCard` (issue #15, PRD FR-6.4) is self-contained — it runs its
 * own count and links to the loans list pre-filtered to `overdue` — and it
 * renders even for an empty register, because "0 overdue" is a true and
 * useful figure where the asset cards' empty state stands in for meaningless
 * zeros.
 */
export default async function HomePage() {
  const user = await requireUser();
  const isAdmin = user.role === ADMIN_ROLE;
  const locale = await getLocale();
  const t = await getTranslations("DashboardPage");
  const tAssets = await getTranslations("AssetsPage");

  const metrics = await loadDashboardMetrics({ includeTotalValue: isAdmin });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      {metrics.totalAssets === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          {t("emptyState")}
        </p>
      ) : (
        <DashboardSummaryCards
          totalAssetsLabel={t("totalAssetsLabel")}
          totalAssetsValue={formatInteger(metrics.totalAssets, locale)}
          totalValueLabel={isAdmin ? t("totalValueLabel") : null}
          totalValueAmount={
            metrics.totalAcquisitionValue !== null
              ? formatCurrencyIdr(metrics.totalAcquisitionValue, locale)
              : null
          }
          statusBreakdownLabel={t("statusBreakdownLabel")}
          statusRows={toStatusRows(metrics, tAssets, locale)}
          attentionLabel={t("attentionLabel")}
          attentionValue={formatInteger(metrics.attentionCount, locale)}
        />
      )}
      <OverdueLoansCard />
      <DashboardChartsSection metrics={metrics} locale={locale} t={t} />
    </div>
  );
}
