import Link from "next/link";

export interface DashboardStatusRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly href: string;
}

interface DashboardStatusBreakdownCardProps {
  readonly title: string;
  readonly rows: readonly DashboardStatusRow[];
}

/**
 * The "count by status, across all five statuses" card (PRD FR-9.1). Unlike
 * `DashboardStatCard`, this card has five separate destinations rather than
 * one, so each status is its own row-level link rather than the whole card
 * being one — `AssetPagination`'s per-control links use the same reasoning.
 */
export function DashboardStatusBreakdownCard({
  title,
  rows,
}: Readonly<DashboardStatusBreakdownCardProps>) {
  return (
    <div className="border-border bg-background flex flex-col gap-2 rounded-lg border p-4">
      <span className="text-muted-foreground text-sm">{title}</span>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              href={row.href}
              className="hover:bg-accent focus-visible:ring-ring flex items-center justify-between rounded-md px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <span>{row.label}</span>
              <span className="font-medium tabular-nums">{row.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
