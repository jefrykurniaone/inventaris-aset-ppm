"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { FormError } from "@/components/FormError";
import { ASSETS_PATH } from "@/lib/paths";

/**
 * What the create page shows when the asset was written but its first photo
 * was not stored (issue #85).
 *
 * It replaces the form rather than sitting above it. The asset already
 * exists, so leaving a filled-in create form on screen would invite a second
 * one; the two links are the only things left to do, and the first of them is
 * the edit page, where the same photo can be picked again.
 *
 * `reason` is the pipeline's own localised explanation and is `null` when the
 * user cancelled the upload, which needs no explaining.
 */

interface AssetSavedWithoutPhotoProps {
  readonly assetId: string;
  readonly reason: string | null;
}

const LINK_CLASS = "text-primary text-sm hover:underline";

export function AssetSavedWithoutPhoto({
  assetId,
  reason,
}: Readonly<AssetSavedWithoutPhotoProps>) {
  const t = useTranslations("AssetsPage");

  return (
    <section
      aria-labelledby="asset-photo-failed-heading"
      className="flex max-w-2xl flex-col gap-4"
    >
      <h2 id="asset-photo-failed-heading" className="text-lg font-medium">
        {t("photoFailedTitle")}
      </h2>
      <p className="text-sm">{t("photoFailedNotice")}</p>
      <FormError message={reason} />
      <div className="flex flex-wrap gap-4">
        <Link href={`${ASSETS_PATH}/${assetId}/edit`} className={LINK_CLASS}>
          {t("photoFailedAddPhoto")}
        </Link>
        <Link href={ASSETS_PATH} className={LINK_CLASS}>
          {t("backToList")}
        </Link>
      </div>
    </section>
  );
}
