import { z } from "zod";

import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format-date";
import { formatCurrencyIdr, formatYear } from "@/lib/format-number";

import {
  ASSET_DETAIL_FIELD_SPECS,
  ASSET_PROCUREMENT_FIELD_SPECS,
  type AssetsPlainMessageKey,
} from "../asset-field-specs";
import {
  ASSET_FIELD_NAMES,
  ASSET_STATUSES,
  type AssetCondition,
  type AssetFieldName,
  type AssetStatus,
} from "../schemas";

/**
 * Turns one `AssetActivity` row's `type` and `payload` (PRD FR-8.1, FR-8.3)
 * into a plan the timeline can render, without ever trusting the shape of a
 * stored `Json` column at the type level. Kept pure and free of both
 * `@/lib/db` and `next-intl`, so it is unit-testable on its own — the same
 * split `../activity.ts` (issue #7) already makes for the diff rules that
 * write these payloads in the first place.
 *
 * A payload that fails to parse renders as `"unrecognised"` rather than
 * throwing: the trail is read-only (FR-8.3), so a row this code cannot make
 * sense of — a future event type, an older payload shape — must still let
 * every other row in the timeline render.
 */

export const ACTIVITY_EVENT_TYPES = [
  "created",
  "updated",
  "status_changed",
  "photo_added",
  "photo_removed",
  "loaned",
  "returned",
  "deleted",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

const ACTIVITY_EVENT_TYPE_SET: ReadonlySet<string> = new Set(
  ACTIVITY_EVENT_TYPES,
);

/** Event types whose payload carries nothing the timeline displays beyond
 * the event itself — `created`/`deleted`'s `assetCode` and
 * `photo_added`/`photo_removed`'s object path are not shown, since the page
 * they describe already names the asset and never a stored file name. */
export type SimpleActivityEventType = Exclude<
  ActivityEventType,
  "status_changed" | "updated"
>;

const SIMPLE_EVENT_TYPES: readonly SimpleActivityEventType[] = [
  "created",
  "deleted",
  "photo_added",
  "photo_removed",
  "loaned",
  "returned",
];

const SIMPLE_EVENT_TYPE_SET: ReadonlySet<ActivityEventType> = new Set(
  SIMPLE_EVENT_TYPES,
);

/** The fields whose *identity* changed rather than a value a person reads —
 * a category, room or funding source id is meaningless on its own, and
 * resolving it to a name here would mean a second database round trip per
 * changed row of every timeline render. The field label alone is shown. */
const OPAQUE_ID_FIELDS: ReadonlySet<AssetFieldName> = new Set([
  "categoryId",
  "roomId",
  "fundingSourceId",
]);

const ASSET_FIELD_NAME_SET: ReadonlySet<string> = new Set(ASSET_FIELD_NAMES);
const ASSET_STATUS_SET: ReadonlySet<string> = new Set(ASSET_STATUSES);

function isAssetFieldName(value: string): value is AssetFieldName {
  return ASSET_FIELD_NAME_SET.has(value);
}

export type ChangeValueDisplay =
  | { readonly kind: "empty" }
  | { readonly kind: "condition"; readonly value: AssetCondition }
  | { readonly kind: "text"; readonly text: string };

/** Formats one side (`from` or `to`) of a changed field's value. `null`
 * becomes `"empty"` rather than the string `"null"`; the caller resolves
 * that to a localised "not set". */
export function describeChangeValue(
  field: AssetFieldName,
  value: string | number | null,
  locale: Locale,
): ChangeValueDisplay {
  if (value === null) {
    return { kind: "empty" };
  }
  if (field === "condition") {
    return { kind: "condition", value: value as AssetCondition };
  }
  if (field === "acquisitionYear") {
    return { kind: "text", text: formatYear(Number(value)) };
  }
  if (field === "purchasePrice") {
    return { kind: "text", text: formatCurrencyIdr(Number(value), locale) };
  }
  if (field === "warrantyUntil") {
    return { kind: "text", text: formatDate(new Date(String(value)), locale) };
  }
  return { kind: "text", text: String(value) };
}

export interface ActivityFieldChangePlan {
  readonly field: AssetFieldName;
  readonly isOpaque: boolean;
  readonly from: ChangeValueDisplay;
  readonly to: ChangeValueDisplay;
}

export type ActivityRowPlan =
  | { readonly kind: "simple"; readonly type: SimpleActivityEventType }
  | {
      readonly kind: "status_changed";
      readonly from: AssetStatus | null;
      readonly to: AssetStatus | null;
    }
  | {
      readonly kind: "updated";
      readonly changes: readonly ActivityFieldChangePlan[];
    }
  | { readonly kind: "unrecognised" };

const fieldChangeSchema = z.object({
  from: z.union([z.string(), z.number(), z.null()]),
  to: z.union([z.string(), z.number(), z.null()]),
});

const statusChangedPayloadSchema = z.object({
  from: z.string(),
  to: z.string(),
});

const updatedPayloadSchema = z.object({
  changes: z.record(z.string(), fieldChangeSchema),
});

/** A stored status string resolved to a known enum member, or `null` for
 * anything else — defensive against a status value from before an enum
 * member was renamed, rather than a crash on an unrecognised string. */
function toKnownStatus(value: string): AssetStatus | null {
  return ASSET_STATUS_SET.has(value) ? (value as AssetStatus) : null;
}

function planStatusChanged(payload: unknown): ActivityRowPlan {
  const parsed = statusChangedPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { kind: "unrecognised" };
  }
  return {
    kind: "status_changed",
    from: toKnownStatus(parsed.data.from),
    to: toKnownStatus(parsed.data.to),
  };
}

function planUpdated(payload: unknown, locale: Locale): ActivityRowPlan {
  const parsed = updatedPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { kind: "unrecognised" };
  }

  const changes: ActivityFieldChangePlan[] = [];
  for (const [field, change] of Object.entries(parsed.data.changes)) {
    if (!isAssetFieldName(field)) {
      continue;
    }
    changes.push({
      field,
      isOpaque: OPAQUE_ID_FIELDS.has(field),
      from: describeChangeValue(field, change.from, locale),
      to: describeChangeValue(field, change.to, locale),
    });
  }
  return { kind: "updated", changes };
}

/** The rendering plan for one activity row. `type` is read as a plain
 * `string` (see `AssetActivityRow` in `activity-queries.ts`) rather than the
 * generated `ActivityType` enum, so this module stays free of `@/lib/db` —
 * an unrecognised string simply plans as `"unrecognised"`. */
export function planActivityRow(
  type: string,
  payload: unknown,
  locale: Locale,
): ActivityRowPlan {
  if (!ACTIVITY_EVENT_TYPE_SET.has(type)) {
    return { kind: "unrecognised" };
  }
  const eventType = type as ActivityEventType;

  if (SIMPLE_EVENT_TYPE_SET.has(eventType)) {
    return { kind: "simple", type: eventType as SimpleActivityEventType };
  }
  if (eventType === "status_changed") {
    return planStatusChanged(payload);
  }
  return planUpdated(payload, locale);
}

/** Every writable field's `AssetsPage` label key, reused from the form's own
 * field specs (`../asset-field-specs.ts`) so the timeline names a field the
 * same way the form that changed it does — one mapping rather than a second
 * one that can drift. */
export const ACTIVITY_FIELD_LABEL_KEYS: Readonly<
  Record<AssetFieldName, AssetsPlainMessageKey>
> = Object.fromEntries(
  [...ASSET_DETAIL_FIELD_SPECS, ...ASSET_PROCUREMENT_FIELD_SPECS].map(
    (spec) => [spec.name, spec.labelKey],
  ),
) as Record<AssetFieldName, AssetsPlainMessageKey>;
