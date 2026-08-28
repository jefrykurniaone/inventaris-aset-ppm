import { getLocale, getTranslations } from "next-intl/server";

import { formatInteger } from "@/lib/format-number";

import { attentionFilterHref } from "./dashboard-links";
import { DashboardNeedsActionCard } from "./DashboardNeedsActionCard";

/**
 * The dashboard's requires-attention figure (PRD FR-9.1): assets that are in
 * repair or lost, or in poor condition. Spec #138 moved it out of the summary
 * grid and into the "needs action" row beside the overdue-loans card, in that
 * card's shape — so both render through `DashboardNeedsActionCard`.
 *
 * The count arrives as a prop, from `loadDashboardMetrics`'s single
 * `Promise.all`, for the same reason the overdue count does: a card that asks
 * its own question cannot dispatch that query until the page component has
 * finished awaiting, which costs one extra serialised round trip on every
 * dashboard navigation (issue #83).
 *
 * The number and the link are the same question asked twice —
 * `buildAttentionCountWhere` and the list's `attention=1` filter both come
 * from `src/lib/asset-attention.ts`, so the count is exactly the number of
 * rows the link leads to.
 */

interface DashboardAttentionCardProps {
  readonly count: number;
}

export async function DashboardAttentionCard({
  count,
}: Readonly<DashboardAttentionCardProps>) {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("DashboardPage"),
  ]);

  return (
    <DashboardNeedsActionCard
      headingId="dashboard-attention-heading"
      title={t("attentionLabel")}
      value={formatInteger(count, locale)}
      description={t("attentionCardCount", { count })}
      linkLabel={t("attentionCardLink")}
      href={attentionFilterHref()}
    />
  );
}
