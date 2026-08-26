import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { formatInteger } from "@/lib/format-number";
import { LOANS_PATH } from "@/lib/paths";

/**
 * The dashboard's overdue-loans figure (PRD FR-6.4), as a card that renders a
 * count its caller has already fetched and links to the loans list already
 * filtered to `overdue`.
 *
 * The count arrives as a prop rather than from a `countOverdueLoans` call in
 * this body, which is a deliberate reversal of how the card shipped in issue
 * #15. An async server component's own queries cannot start until the page
 * component that renders it has finished awaiting, so a self-contained card
 * bought its independence at the price of one extra serialised database round
 * trip on every dashboard navigation — against a database in Singapore, that
 * was the difference the card charged for asking its own question (issue #83).
 * `loadDashboardMetrics` now asks it inside the same `Promise.all` as the
 * asset aggregates.
 *
 * The number and the link are still the same question asked twice:
 * `countOverdueLoans` and the list's `overdue` filter both come from
 * `buildOverdueLoanWhere`, so the count is exactly the number of rows the link
 * leads to.
 */

const OVERDUE_FILTER_HREF = `${LOANS_PATH}?state=overdue`;

interface OverdueLoansCardProps {
  readonly count: number;
}

export async function OverdueLoansCard({
  count,
}: Readonly<OverdueLoansCardProps>) {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("LoansPage"),
  ]);

  return (
    <section
      aria-labelledby="overdue-loans-heading"
      className="border-border flex flex-col gap-2 rounded-lg border p-5"
    >
      <h2
        id="overdue-loans-heading"
        className="text-sm font-medium tracking-wide uppercase"
      >
        {t("overdueCardTitle")}
      </h2>
      <p className="text-3xl font-semibold tabular-nums">
        {formatInteger(count, locale)}
      </p>
      <p className="text-muted-foreground text-sm">
        {t("overdueCardCount", { count })}
      </p>
      <Link
        href={OVERDUE_FILTER_HREF}
        className="text-primary text-sm hover:underline"
      >
        {t("overdueCardLink")}
      </Link>
    </section>
  );
}
