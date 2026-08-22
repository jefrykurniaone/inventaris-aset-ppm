import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ActivityRow } from "./ActivityRow";
import {
  ACTIVITY_WINDOW_STEP,
  findAssetActivityWindow,
} from "./activity-queries";

interface ActivityTimelineProps {
  readonly assetId: string;
  readonly windowSize: number;
}

/**
 * The activity timeline (PRD FR-8.2, FR-8.3): reverse-chronological, capped
 * at `windowSize` rows with a "show more" link that asks for the next
 * window — never an unbounded render (issue #10's explicit constraint).
 *
 * A `Link` to a wider `?activity=` window rather than client-side pagination
 * state: this is a Server Component, the window is already carried in the
 * URL for the initial load, and a plain link keeps the whole surface working
 * with JavaScript disabled, the same property the public scan page (#11)
 * will need for its own reasons.
 */
export async function ActivityTimeline({
  assetId,
  windowSize,
}: Readonly<ActivityTimelineProps>) {
  const [locale, t, td, { rows, hasMore }] = await Promise.all([
    getLocale(),
    getTranslations("AssetsPage"),
    getTranslations("AssetDetailPage"),
    findAssetActivityWindow(assetId, windowSize),
  ]);

  return (
    <section
      aria-labelledby="asset-activity-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="asset-activity-heading" className="text-lg font-semibold">
        {td("activityHeading")}
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{td("activityEmpty")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              locale={locale}
              t={t}
              td={td}
            />
          ))}
        </ol>
      )}
      {hasMore ? (
        <Link
          href={`?activity=${windowSize + ACTIVITY_WINDOW_STEP}#asset-activity-heading`}
          className="text-primary text-sm hover:underline"
        >
          {td("activityShowMore")}
        </Link>
      ) : null}
    </section>
  );
}
