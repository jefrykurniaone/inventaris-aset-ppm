import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ASSETS_PATH } from "@/lib/paths";
import { requireUser } from "@/lib/require-user";

import { createAssetAction } from "../actions";
import { AssetForm } from "../AssetForm";
import { listAssetFormOptions } from "../queries";

/**
 * Asset creation (PRD FR-2.1 to FR-2.4). No `assetCode` and no `qrToken`
 * appear on this form: both are generated server-side inside `createAsset`,
 * so there is nothing here for a bypassed client to submit.
 */
export default async function NewAssetPage() {
  await requireUser();
  const t = await getTranslations("AssetsPage");
  const options = await listAssetFormOptions();

  return (
    <div className="flex flex-col gap-6">
      <Link href={ASSETS_PATH} className="text-primary text-sm hover:underline">
        {t("backToList")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("createTitle")}
      </h1>
      <AssetForm
        action={createAssetAction}
        submitLabel={t("createSubmit")}
        submitPendingLabel={t("createSubmitPending")}
        options={options}
      />
    </div>
  );
}
