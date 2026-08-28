import { DashboardStatCard } from "./DashboardStatCard";
import {
  DashboardStatusBreakdownCard,
  type DashboardStatusRow,
} from "./DashboardStatusBreakdownCard";
import { ALL_ASSETS_HREF, missingPhotoFilterHref } from "./dashboard-links";

interface DashboardSummaryCardsProps {
  readonly totalAssetsLabel: string;
  readonly totalAssetsValue: string;
  /** Both `null` together for a staff session — see `HomePage`, which never
   * even asks `dashboard-queries.ts` to compute a value in that case. */
  readonly totalValueLabel: string | null;
  readonly totalValueAmount: string | null;
  readonly statusBreakdownLabel: string;
  readonly statusRows: readonly DashboardStatusRow[];
  readonly missingPhotoLabel: string;
  readonly missingPhotoValue: string;
}

/**
 * The four PRD FR-9.1 summary cards, minus the total-value card for a staff
 * session: `totalValueLabel`/`totalValueAmount` being `null` is what omits
 * it, not a CSS visibility rule — the figure was never computed for that
 * session in the first place (`dashboard-queries.ts`), so there is nothing
 * here to hide.
 *
 * The fourth slot holds the missing-photo card. It used to hold the
 * requires-attention card, which spec #138 moved down to the "needs action"
 * row beside the overdue-loans card: the two figures answer different
 * questions for different people, and only the attention one belongs with
 * work that is already overdue.
 */
export function DashboardSummaryCards({
  totalAssetsLabel,
  totalAssetsValue,
  totalValueLabel,
  totalValueAmount,
  statusBreakdownLabel,
  statusRows,
  missingPhotoLabel,
  missingPhotoValue,
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
        title={missingPhotoLabel}
        value={missingPhotoValue}
        href={missingPhotoFilterHref()}
      />
    </div>
  );
}
