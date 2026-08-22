import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ASSETS_PATH } from "@/lib/paths";
import { requireUser } from "@/lib/require-user";

import { updateAssetAction } from "../../actions";
import { AssetForm } from "../../AssetForm";
import { findAssetForEdit, listAssetFormOptions } from "../../queries";

interface EditAssetPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Asset editing (PRD FR-2.4). Every field on the create form is editable
 * here, `category` and `acquisitionYear` included — but `assetCode` is not
 * regenerated when either changes, because the label carrying it is already
 * on the item. `AssetForm` shows the issued code and says so.
 *
 * A soft-deleted asset is `notFound()` here rather than editable: FR-2.5
 * takes it out of the register, and its scan page — not this form — is what
 * a withdrawn record still answers on (#11).
 */
export default async function EditAssetPage({
  params,
}: Readonly<EditAssetPageProps>) {
  await requireUser();
  const { id } = await params;
  const t = await getTranslations("AssetsPage");

  const asset = await findAssetForEdit(id);
  if (!asset) {
    notFound();
  }

  const options = await listAssetFormOptions({
    categoryId: asset.defaults.categoryId,
    roomId: asset.defaults.roomId,
    fundingSourceId: asset.defaults.fundingSourceId || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <Link href={ASSETS_PATH} className="text-primary text-sm hover:underline">
        {t("backToList")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("editTitle")}
      </h1>
      <AssetForm
        action={updateAssetAction}
        submitLabel={t("editSubmit")}
        submitPendingLabel={t("editSubmitPending")}
        options={options}
        assetId={asset.id}
        assetCode={asset.assetCode}
        defaults={asset.defaults}
      />
    </div>
  );
}
