import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { formatInteger } from "@/lib/format-number";
import { LOANS_PATH } from "@/lib/paths";

import { countOverdueLoans } from "./list-queries";

/**
 * The dashboard's overdue-loans figure (PRD FR-6.4), as a self-contained card:
 * it takes no props, runs its own count, and links to the loans list already
 * filtered to `overdue`.
 *
 * No props on purpose. Issue #13 rebuilds the landing page in parallel with
 * this ticket, and a card that needs nothing wired to it can be mounted with
 * one import and one element wherever that page ends up — no aggregation to
 * plumb, no shape for the two branches to disagree about.
 *
 * The number and the link are the same question asked twice:
 * `countOverdueLoans` and the list's `overdue` filter both come from
 * `buildOverdueLoanWhere`, so the count is exactly the number of rows the link
 * leads to.
 */

const OVERDUE_FILTER_HREF = `${LOANS_PATH}?state=overdue`;

export async function OverdueLoansCard() {
  const [locale, t, count] = await Promise.all([
    getLocale(),
    getTranslations("LoansPage"),
    countOverdueLoans(new Date()),
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
