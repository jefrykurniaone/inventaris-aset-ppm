import type { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format-date";
import { formatRelativeTime } from "@/lib/format-relative-time";

import { CONDITION_LABEL_KEYS, STATUS_LABEL_KEYS } from "../asset-field-specs";
import type { AssetStatus } from "../schemas";
import {
  ACTIVITY_FIELD_LABEL_KEYS,
  planActivityRow,
  type ActivityFieldChangePlan,
  type ChangeValueDisplay,
  type SimpleActivityEventType,
} from "./activity-display";
import type { AssetActivityRow } from "./activity-queries";

/**
 * One row of the activity timeline (PRD FR-8.2): actor, event, changed
 * fields, and a relative time that also carries the exact instant in its
 * `title`, for anyone who wants more precision than "3 hours ago" gives.
 *
 * Split out of `ActivityTimeline.tsx` so that component's own body stays
 * under the project's 40-line limit — the same reason `AssetRow` is split
 * out of `AssetTable` (issue #8).
 */

type AssetsTranslate = Awaited<
  ReturnType<typeof getTranslations<"AssetsPage">>
>;
type DetailTranslate = Awaited<
  ReturnType<typeof getTranslations<"AssetDetailPage">>
>;

/**
 * The `AssetDetailPage` keys callable as a bare `td(key)`, excluding the
 * handful that interpolate ICU values (`changeValueLine`,
 * `eventStatusChanged`, `lightboxCounter`, `lightboxOpenLabel`,
 * `withdrawnDescription`) — every one of those is always called with its
 * literal key and values directly, never through this type. Same reasoning
 * as `AssetsPlainMessageKey` in `../asset-field-specs.ts`: a translator
 * parameter typed as the *full* union of keys demands a values argument for
 * every call, because one member of that union needs one.
 */
type DetailPlainMessageKey = Exclude<
  Parameters<DetailTranslate>[0],
  | "changeValueLine"
  | "eventStatusChanged"
  | "lightboxCounter"
  | "lightboxOpenLabel"
  | "withdrawnDescription"
>;

const SIMPLE_EVENT_LABEL_KEYS: Record<
  SimpleActivityEventType,
  DetailPlainMessageKey
> = {
  created: "eventCreated",
  deleted: "eventDeleted",
  photo_added: "eventPhotoAdded",
  photo_removed: "eventPhotoRemoved",
  loaned: "eventLoaned",
  returned: "eventReturned",
};

function statusLabel(
  status: AssetStatus | null,
  t: AssetsTranslate,
  td: DetailTranslate,
): string {
  return status === null ? td("notSet") : t(STATUS_LABEL_KEYS[status]);
}

function changeValueText(
  display: ChangeValueDisplay,
  t: AssetsTranslate,
  td: DetailTranslate,
): string {
  if (display.kind === "empty") {
    return td("notSet");
  }
  if (display.kind === "condition") {
    return t(CONDITION_LABEL_KEYS[display.value]);
  }
  return display.text;
}

function ChangeLine({
  change,
  t,
  td,
}: Readonly<{
  change: ActivityFieldChangePlan;
  t: AssetsTranslate;
  td: DetailTranslate;
}>) {
  const field = t(ACTIVITY_FIELD_LABEL_KEYS[change.field]);
  if (change.isOpaque) {
    return <li>{td("changeLabelLine", { field })}</li>;
  }
  return (
    <li>
      {td("changeValueLine", {
        field,
        from: changeValueText(change.from, t, td),
        to: changeValueText(change.to, t, td),
      })}
    </li>
  );
}

interface ActivityRowProps {
  readonly activity: AssetActivityRow;
  readonly locale: Locale;
  readonly t: AssetsTranslate;
  readonly td: DetailTranslate;
}

function ActivityRowBody({
  activity,
  locale,
  t,
  td,
}: Readonly<ActivityRowProps>) {
  const plan = planActivityRow(activity.type, activity.payload, locale);

  if (plan.kind === "simple") {
    return <p>{td(SIMPLE_EVENT_LABEL_KEYS[plan.type])}</p>;
  }
  if (plan.kind === "status_changed") {
    return (
      <p>
        {td("eventStatusChanged", {
          from: statusLabel(plan.from, t, td),
          to: statusLabel(plan.to, t, td),
        })}
      </p>
    );
  }
  if (plan.kind === "updated") {
    return (
      <div className="flex flex-col gap-1">
        <p>{td("eventUpdated")}</p>
        <ul className="text-muted-foreground list-inside list-disc text-sm">
          {plan.changes.map((change) => (
            <ChangeLine key={change.field} change={change} t={t} td={td} />
          ))}
        </ul>
      </div>
    );
  }
  return <p>{td("eventUnrecognised")}</p>;
}

export function ActivityRow({
  activity,
  locale,
  t,
  td,
}: Readonly<ActivityRowProps>) {
  return (
    <li className="border-border flex flex-col gap-1 border-b pb-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{activity.actorName}</span>
        <time
          dateTime={activity.createdAt.toISOString()}
          title={formatDateTime(activity.createdAt, locale)}
          className="text-muted-foreground"
        >
          {formatRelativeTime(activity.createdAt, locale)}
        </time>
      </div>
      <ActivityRowBody activity={activity} locale={locale} t={t} td={td} />
    </li>
  );
}
