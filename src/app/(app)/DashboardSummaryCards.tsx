import { DashboardStatCard } from "./DashboardStatCard";
import {
  DashboardStatusBreakdownCard,
  type DashboardStatusRow,
} from "./DashboardStatusBreakdownCard";
import { ALL_ASSETS_HREF, attentionFilterHref } from "./dashboard-links";

interface DashboardSummaryCardsProps {
  readonly totalAssetsLabel: string;
  readonly totalAssetsValue: string;
  /** Both `null` together for a staff session — see `HomePage`, which never
   * even asks `dashboard-queries.ts` to compute a value in that case. */
  readonly totalValueLabel: string | null;
  readonly totalValueAmount: string | null;
  readonly statusBreakdownLabel: string;
  readonly statusRows: readonly DashboardStatusRow[];
  readonly attentionLabel: string;
  readonly attentionValue: string;
}

/**
 * The four PRD FR-9.1 summary cards, minus the total-value card for a staff
 * session: `totalValueLabel`/`totalValueAmount` being `null` is what omits
 * it, not a CSS visibility rule — the figure was never computed for that
 * session in the first place (`dashboard-queries.ts`), so there is nothing
 * here to hide.
 */
export function DashboardSummaryCards({
  totalAssetsLabel,
  totalAssetsValue,
  totalValueLabel,
  totalValueAmount,
  statusBreakdownLabel,
  statusRows,
  attentionLabel,
  attentionValue,
}: Readonly<DashboardSummaryCardsProps>) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DashboardStatCard
        title={totalAssetsLabel}
        value={totalAssetsValue}
        href={ALL_ASSETS_HREF}
      />
      {totalValueLabel !== null && totalValueAmount !== null ? (
        <DashboardStatCard
          title={totalValueLabel}
          value={totalValueAmount}
          href={ALL_ASSETS_HREF}
        />
      ) : null}
      <DashboardStatusBreakdownCard
        title={statusBreakdownLabel}
        rows={statusRows}
      />
      <DashboardStatCard
        title={attentionLabel}
        value={attentionValue}
        href={attentionFilterHref()}
      />
    </div>
  );
}
