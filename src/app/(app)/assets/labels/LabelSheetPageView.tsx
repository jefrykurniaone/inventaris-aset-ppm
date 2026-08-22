import type { getTranslations } from "next-intl/server";

import type { LabelSheetPage } from "@/lib/label-pagination";

import { LabelCell } from "./LabelCell";
import type { LabelAssetRow } from "./queries";

type LabelsT = Awaited<ReturnType<typeof getTranslations<"AssetLabelsPage">>>;
type DetailT = Awaited<ReturnType<typeof getTranslations<"AssetDetailPage">>>;

interface LabelSheetPageViewProps {
  readonly sheet: LabelSheetPage;
  readonly assetsById: ReadonlyMap<string, LabelAssetRow>;
  readonly t: LabelsT;
  readonly td: DetailT;
}

/**
 * One A4 sheet of labels (PRD FR-5.4): a CSS grid sized entirely by the
 * `.label-sheet-page` rule `LabelSheetStyle` emits from `LABEL_SHEET`. Each
 * position is either an asset id (printed) or `null` — a blank left by the
 * starting offset. `break-before: page` on every sheet after the first
 * (`src/lib/label-sheet.ts`) is what gives correct pagination across sheets
 * when the selection exceeds `LABELS_PER_SHEET`.
 */
export function LabelSheetPageView({
  sheet,
  assetsById,
  t,
  td,
}: Readonly<LabelSheetPageViewProps>) {
  return (
    <section
      className="label-sheet-page"
      aria-label={t("sheetLabel", { number: sheet.pageNumber })}
    >
      {sheet.positions.map((id, index) => (
        <LabelCell
          // A blank position has no id to key on; `blank-<index>` is unique
          // within one sheet because positions are never reordered.
          key={id ?? `blank-${index}`}
          asset={id === null ? null : (assetsById.get(id) ?? null)}
          t={t}
          td={td}
        />
      ))}
    </section>
  );
}
