import Link from "next/link";

interface DashboardNeedsActionCardProps {
  /** Ties the card's `<section>` to its own `<h2>` via `aria-labelledby`, so
   * each card in the row is announced by its heading rather than as an
   * unnamed region. Unique per card on the page. */
  readonly headingId: string;
  readonly title: string;
  /** The figure itself, already formatted for the active locale. */
  readonly value: string;
  /** One sentence saying what the figure means — the pluralised line under
   * the number, which is also what makes a zero read as good news. */
  readonly description: string;
  readonly linkLabel: string;
  readonly href: string;
}

/**
 * One card in the dashboard's "needs action" row (spec #138): a heading, a
 * large count, a description line, and a link to the pre-filtered list. Both
 * the overdue-loans card (PRD FR-6.4) and the requires-attention card
 * (FR-9.1) are this shape, so the shape is declared once here rather than
 * copied — the two sit side by side, and a divergence would be visible.
 *
 * Presentational and synchronous: every string arrives already translated and
 * every number already formatted, because the two callers read from different
 * `next-intl` namespaces. It renders a `<section>` with a real heading rather
 * than a `<div role="region">` (S6819), and the destination is a `next/link`
 * anchor, so it is keyboard-reachable with no key handler of its own (S1082).
 */
export function DashboardNeedsActionCard({
  headingId,
  title,
  value,
  description,
  linkLabel,
  href,
}: Readonly<DashboardNeedsActionCardProps>) {
  return (
    <section
      aria-labelledby={headingId}
      className="border-border flex flex-col gap-2 rounded-lg border p-5"
    >
      <h2
        id={headingId}
        className="text-sm font-medium tracking-wide uppercase"
      >
        {title}
      </h2>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-sm">{description}</p>
      <Link href={href} className="text-primary text-sm hover:underline">
        {linkLabel}
      </Link>
    </section>
  );
}
