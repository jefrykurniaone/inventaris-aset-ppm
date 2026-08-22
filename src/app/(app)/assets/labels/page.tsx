import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { buildLabelSheets, type LabelSheetPage } from "@/lib/label-pagination";
import { ASSETS_PATH } from "@/lib/paths";
import { requireUser } from "@/lib/require-user";

import { LabelSheetPageView } from "./LabelSheetPageView";
import { LabelSheetStyle } from "./LabelSheetStyle";
import { OffsetForm } from "./OffsetForm";
import { PrintButton } from "./PrintButton";
import type { LabelAssetRow } from "./queries";
import { listLabelAssets } from "./queries";
import { labelsSearchParamsSchema } from "./schemas";

interface AssetLabelsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type LabelsT = Awaited<ReturnType<typeof getTranslations<"AssetLabelsPage">>>;
type DetailT = Awaited<ReturnType<typeof getTranslations<"AssetDetailPage">>>;
type AssetsT = Awaited<ReturnType<typeof getTranslations<"AssetsPage">>>;

interface LabelsToolbarProps {
  readonly ids: readonly string[];
  readonly offset: number;
  readonly assetCount: number;
  readonly missingCount: number;
  readonly t: LabelsT;
  readonly ta: AssetsT;
}

/**
 * Every screen-only control: heading, selection summary, the offset control,
 * and the print / back-to-list actions. `print:hidden` on the wrapper is
 * what keeps this off paper (PRD FR-5.4) — the label sheets below it are the
 * only thing a print of this page produces.
 */
function LabelsToolbar({
  ids,
  offset,
  assetCount,
  missingCount,
  t,
  ta,
}: Readonly<LabelsToolbarProps>) {
  return (
    <div className="flex flex-col gap-4 print:hidden">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground text-sm">
        {t("description", { count: assetCount })}
      </p>
      {missingCount > 0 && (
        <p className="text-destructive-text text-sm" role="status">
          {t("missingNotice", { count: missingCount })}
        </p>
      )}
      {assetCount > 0 && <OffsetForm ids={ids} offset={offset} t={t} />}
      <div className="flex flex-wrap gap-2">
        {assetCount > 0 && <PrintButton label={t("printAction")} />}
        <Button asChild variant="outline">
          <Link href={ASSETS_PATH}>{ta("backToList")}</Link>
        </Button>
      </div>
    </div>
  );
}

interface LabelSheetsProps {
  readonly sheets: readonly LabelSheetPage[];
  readonly assetsById: ReadonlyMap<string, LabelAssetRow>;
  readonly t: LabelsT;
  readonly td: DetailT;
  readonly noAssetsFoundLabel: string;
}

/** The printable content itself: one `<LabelSheetPageView>` per sheet, or the
 * "nothing to print" message when every requested id was invalid, deleted,
 * or not found. */
function LabelSheets({
  sheets,
  assetsById,
  t,
  td,
  noAssetsFoundLabel,
}: Readonly<LabelSheetsProps>) {
  if (sheets.length === 0) {
    return (
      <p className="text-muted-foreground text-sm print:hidden">
        {noAssetsFoundLabel}
      </p>
    );
  }

  return (
    <>
      {sheets.map((sheet) => (
        <LabelSheetPageView
          key={sheet.pageNumber}
          sheet={sheet}
          assetsById={assetsById}
          t={t}
          td={td}
        />
      ))}
    </>
  );
}

/**
 * Bulk QR label printing (issue #12, PRD FR-5.4, FR-5.5). Replaces the
 * minimal stub #7 shipped: the asset list's selection (#8,
 * `AssetSelectionToolbar.tsx`) and the asset detail page's single-asset
 * reprint link (`AssetDetailPage`) both hand their ids to this route as
 * `?ids=<comma-separated ids>` — the contract the stub already established —
 * with an optional `?offset=` for a partly used sheet. Both are Zod-validated
 * server-side (`schemas.ts`) rather than trusted from the query string.
 */
export default async function AssetLabelsPage({
  searchParams,
}: Readonly<AssetLabelsPageProps>) {
  await requireUser();
  const raw = await searchParams;
  const { ids, offset } = labelsSearchParamsSchema.parse({
    ids: raw.ids,
    offset: raw.offset,
  });

  const [t, td, ta] = await Promise.all([
    getTranslations("AssetLabelsPage"),
    getTranslations("AssetDetailPage"),
    getTranslations("AssetsPage"),
  ]);

  const assets = await listLabelAssets(ids);
  const missingCount = ids.length - assets.length;
  const sheets = buildLabelSheets(
    assets.map((asset) => asset.id),
    offset,
  );
  const assetsById: ReadonlyMap<string, LabelAssetRow> = new Map(
    assets.map((asset) => [asset.id, asset]),
  );

  return (
    <div className="flex flex-col gap-4">
      <LabelSheetStyle />
      <LabelsToolbar
        ids={ids}
        offset={offset}
        assetCount={assets.length}
        missingCount={missingCount}
        t={t}
        ta={ta}
      />
      <LabelSheets
        sheets={sheets}
        assetsById={assetsById}
        t={t}
        td={td}
        noAssetsFoundLabel={t("noAssetsFound")}
      />
    </div>
  );
}
