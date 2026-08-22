import Link from "next/link";

export interface DashboardBarChartItem {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly value: string;
  readonly href: string;
}

interface DashboardBarChartProps {
  readonly headingId: string;
  readonly title: string;
  readonly items: readonly DashboardBarChartItem[];
  readonly emptyMessage: string;
}

const MAX_BAR_PERCENT = 100;

/**
 * `0` for an empty chart, not `NaN` from a `0 / 0` division — with no items
 * this branch is never reached anyway (`DashboardBarChart` renders
 * `emptyMessage` instead), but the function stays correct on its own rather
 * than relying on that caller.
 */
function barWidthPercent(count: number, maxCount: number): number {
  if (maxCount <= 0) {
    return 0;
  }
  return Math.round((count / maxCount) * MAX_BAR_PERCENT);
}

/**
 * One bar. The label and the value are real visible text — not baked into
 * an image — so this row is its own accessible alternative with no separate
 * hidden table needed; the coloured bar underneath is purely decorative
 * (`aria-hidden`) and carries no meaning color alone does not already repeat
 * as the text next to it (WCAG 1.4.1).
 */
function DashboardBarChartRow({
  item,
  maxCount,
}: Readonly<{
  item: DashboardBarChartItem;
  maxCount: number;
}>) {
  return (
    <li>
      <Link
        href={item.href}
        className="hover:bg-accent focus-visible:ring-ring flex flex-col gap-1 rounded-md p-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate" title={item.label}>
            {item.label}
          </span>
          <span className="font-medium tabular-nums">{item.value}</span>
        </span>
        <span
          className="bg-muted block h-2 w-full overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <span
            className="bg-primary block h-full rounded-full"
            style={{ width: `${barWidthPercent(item.count, maxCount)}%` }}
          />
        </span>
      </Link>
    </li>
  );
}

/**
 * A horizontal bar list — pure SVG/CSS, no charting library (see the pull
 * request body for the licence/bundle/maintenance/CVE comparison the
 * coding standard asks for before adding one). Used for both dashboard
 * charts (PRD FR-9.2): asset count per category, and acquisition count per
 * year.
 *
 * Legible at phone width because it is a plain vertical list of full-width
 * rows — there is no fixed pixel layout to overflow — and it needs no
 * separate accessible alternative because every value it renders is already
 * text a screen reader reads in document order.
 */
export function DashboardBarChart({
  headingId,
  title,
  items,
  emptyMessage,
}: Readonly<DashboardBarChartProps>) {
  const maxCount = items.reduce((max, item) => Math.max(max, item.count), 0);

  return (
    <section
      aria-labelledby={headingId}
      className="border-border bg-background flex flex-col gap-3 rounded-lg border p-4"
    >
      <h2 id={headingId} className="text-sm font-medium">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <DashboardBarChartRow
              key={item.key}
              item={item}
              maxCount={maxCount}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
