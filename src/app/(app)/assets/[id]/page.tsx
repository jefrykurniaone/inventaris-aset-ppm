import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DeleteControl } from "@/components/DeleteControl";
import { Button } from "@/components/ui/button";
import { ASSETS_PATH } from "@/lib/paths";
import { requireUser } from "@/lib/require-user";
import { buildScanUrl } from "@/lib/scan-url";

import { deleteAssetAction } from "../actions";
import { CONDITION_LABEL_KEYS, STATUS_LABEL_KEYS } from "../asset-field-specs";
import { assetIdSchema } from "../schemas";
import { ActivityTimeline } from "./ActivityTimeline";
import { parseActivityWindow } from "./activity-queries";
import { AssetDetailSections } from "./AssetDetailSections";
import { CopyScanUrlButton } from "./CopyScanUrlButton";
import { LoanPanel } from "./LoanPanel";
import { PhotoGallery } from "./PhotoGallery";
import {
  findAssetDetail,
  type AssetDetailRecord,
  type WithdrawnAssetSummary,
} from "./queries";

interface AssetDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function labelsPath(assetId: string): string {
  return `${ASSETS_PATH}/labels?ids=${assetId}`;
}

function editPath(assetId: string): string {
  return `${ASSETS_PATH}/${assetId}/edit`;
}

type AssetsT = Awaited<ReturnType<typeof getTranslations<"AssetsPage">>>;
type DetailT = Awaited<ReturnType<typeof getTranslations<"AssetDetailPage">>>;

function AssetDetailActions({
  asset,
  t,
  td,
}: Readonly<{ asset: AssetDetailRecord; t: AssetsT; td: DetailT }>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={editPath(asset.id)}>{t("edit")}</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={labelsPath(asset.id)}>{td("printLabelLink")}</Link>
      </Button>
      <DeleteControl
        action={deleteAssetAction}
        id={asset.id}
        triggerLabel={t("delete")}
        pendingLabel={t("deletePending")}
        title={t("deleteConfirmTitle", { assetCode: asset.assetCode })}
        description={t("deleteConfirmDescription")}
        cancelLabel={t("cancel")}
        confirmLabel={t("deleteConfirm")}
      />
    </div>
  );
}

function ScanUrlSection({
  asset,
  td,
}: Readonly<{ asset: AssetDetailRecord; td: DetailT }>) {
  const scanUrl = buildScanUrl(asset.qrToken);
  return (
    <section
      aria-labelledby="asset-scan-url-heading"
      className="border-border flex flex-col gap-2 rounded-md border p-4"
    >
      <h2 id="asset-scan-url-heading" className="text-lg font-semibold">
        {td("scanUrlHeading")}
      </h2>
      <p className="text-muted-foreground text-sm">
        {td("scanUrlDescription")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={scanUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary font-mono text-sm break-all hover:underline"
        >
          {scanUrl}
        </a>
        <CopyScanUrlButton
          scanUrl={scanUrl}
          copyLabel={td("scanUrlCopyLabel")}
          copiedLabel={td("scanUrlCopiedLabel")}
        />
      </div>
    </section>
  );
}

function AssetDetailHeader({
  asset,
  t,
}: Readonly<{ asset: AssetDetailRecord; t: AssetsT }>) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground font-mono text-sm">
        {asset.assetCode}
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
      <p className="text-muted-foreground text-sm">
        {t(STATUS_LABEL_KEYS[asset.status])} ·{" "}
        {t(CONDITION_LABEL_KEYS[asset.condition])}
      </p>
    </div>
  );
}

async function AssetDetailView({
  asset,
  activityWindow,
}: Readonly<{ asset: AssetDetailRecord; activityWindow: number }>) {
  const [t, td] = await Promise.all([
    getTranslations("AssetsPage"),
    getTranslations("AssetDetailPage"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href={ASSETS_PATH} className="text-primary text-sm hover:underline">
        {t("backToList")}
      </Link>
      <AssetDetailHeader asset={asset} t={t} />
      <AssetDetailActions asset={asset} t={t} td={td} />
      <ScanUrlSection asset={asset} td={td} />
      <PhotoGallery assetId={asset.id} />
      <LoanPanel status={asset.status} />
      <AssetDetailSections asset={asset} />
      <ActivityTimeline assetId={asset.id} windowSize={activityWindow} />
    </div>
  );
}

async function WithdrawnAssetView({
  asset,
}: Readonly<{ asset: WithdrawnAssetSummary }>) {
  const [t, td] = await Promise.all([
    getTranslations("AssetsPage"),
    getTranslations("AssetDetailPage"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href={ASSETS_PATH} className="text-primary text-sm hover:underline">
        {t("backToList")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        {td("withdrawnTitle")}
      </h1>
      <p className="text-muted-foreground">
        {td("withdrawnDescription", {
          assetCode: asset.assetCode,
          name: asset.name,
        })}
      </p>
    </div>
  );
}

/**
 * The authenticated asset detail page (issue #10): the full record, the
 * photo gallery, the loan stub, the activity timeline, and the actions that
 * hang off one asset. Both roles see every field here — see the note atop
 * `./queries.ts` for why that departs from the public/restricted split.
 *
 * A soft-deleted asset renders `WithdrawnAssetView` rather than `notFound()`
 * (PRD FR-2.5); a genuinely missing id is a real `notFound()`.
 */
export default async function AssetDetailPage({
  params,
  searchParams,
}: Readonly<AssetDetailPageProps>) {
  await requireUser();
  const { id: rawId } = await params;
  const parsedId = assetIdSchema.safeParse(rawId);
  if (!parsedId.success) {
    notFound();
  }

  const { activity: rawActivityWindow } = await searchParams;
  const activityWindow = parseActivityWindow(rawActivityWindow);

  const result = await findAssetDetail(parsedId.data);
  if (result.kind === "not_found") {
    notFound();
  }
  if (result.kind === "withdrawn") {
    return <WithdrawnAssetView asset={result} />;
  }
  return (
    <AssetDetailView asset={result.asset} activityWindow={activityWindow} />
  );
}
