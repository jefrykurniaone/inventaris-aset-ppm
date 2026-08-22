import Link from "next/link";

interface DashboardStatCardProps {
  readonly title: string;
  readonly value: string;
  readonly href: string;
}

/**
 * One summary figure (PRD FR-9.1): a label, a big number, and a link to the
 * matching filtered asset list. The total-assets and total-value cards both
 * link to the plain, unfiltered list — every live asset is exactly what
 * either figure is computed over — while the "requiring attention" card
 * links to `?attention=1`. The status breakdown is its own component
 * (`DashboardStatusBreakdownCard`) because it has five destinations, not one.
 *
 * The whole card is the link, rendered as a real `<a>` via `next/link`
 * rather than a `<div>` with a click handler: that is what makes it reachable
 * by keyboard with no extra `role` or `onKeyDown` (S1082, S6819).
 */
export function DashboardStatCard({
  title,
  value,
  href,
}: Readonly<DashboardStatCardProps>) {
  return (
    <Link
      href={href}
      className="border-border bg-background hover:bg-accent focus-visible:ring-ring flex flex-col gap-1 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="text-muted-foreground text-sm">{title}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
    </Link>
  );
}
