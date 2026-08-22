import type { AssetExportLabels } from "@/lib/asset-export";
import type { AssetExportColumn } from "@/lib/asset-export-columns";

import type { AssetsTranslate } from "../asset-field-specs";
import { CONDITION_LABEL_KEYS, STATUS_LABEL_KEYS } from "../asset-field-specs";

/**
 * The export's localised text (issue #14): column headers and the two fixed
 * enumerations, in the locale the requesting user's `NEXT_LOCALE` cookie
 * selects.
 *
 * Both maps are written out member by member rather than built from
 * `Object.fromEntries`, which would need a cast back to the exact record type.
 * Written this way a new `AssetStatus` is a compile error here — the one place
 * that has to translate it — instead of an untranslated raw enum value like
 * `in_repair` appearing in a spreadsheet a directorate sends onward.
 */

function buildStatusLabels(t: AssetsTranslate): AssetExportLabels["status"] {
  return {
    active: t(STATUS_LABEL_KEYS.active),
    in_repair: t(STATUS_LABEL_KEYS.in_repair),
    loaned: t(STATUS_LABEL_KEYS.loaned),
    retired: t(STATUS_LABEL_KEYS.retired),
    lost: t(STATUS_LABEL_KEYS.lost),
  };
}

function buildConditionLabels(
  t: AssetsTranslate,
): AssetExportLabels["condition"] {
  return {
    good: t(CONDITION_LABEL_KEYS.good),
    fair: t(CONDITION_LABEL_KEYS.fair),
    poor: t(CONDITION_LABEL_KEYS.poor),
  };
}

export function buildAssetExportLabels(t: AssetsTranslate): AssetExportLabels {
  return { status: buildStatusLabels(t), condition: buildConditionLabels(t) };
}

export function buildAssetExportHeaders(
  columns: readonly AssetExportColumn[],
  t: AssetsTranslate,
): readonly string[] {
  return columns.map((column) => t(column.labelKey));
}
