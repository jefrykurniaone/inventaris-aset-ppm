"use client";

import { useTranslations } from "next-intl";

import { AssetForm } from "../AssetForm";
import type { AssetFormOptions } from "../schemas";

import { AssetSavedWithoutPhoto } from "./AssetSavedWithoutPhoto";
import { FirstPhotoField } from "./FirstPhotoField";
import { useCreateWithPhoto } from "./use-create-with-photo";

/**
 * The create form, wrapped in the two-step flow issue #85 asks for: one
 * submission registers the asset and, when the user picked one, attaches its
 * first photo before navigating to the list.
 *
 * The edit page keeps `AssetForm` on its own, with `AssetPhotoSection`
 * underneath — nothing about that flow changes here.
 */

interface CreateAssetFormProps {
  readonly options: AssetFormOptions;
}

export function CreateAssetForm({ options }: Readonly<CreateAssetFormProps>) {
  const t = useTranslations("AssetsPage");
  const create = useCreateWithPhoto();

  if (create.failure) {
    return (
      <AssetSavedWithoutPhoto
        assetId={create.failure.assetId}
        reason={create.failure.reason}
      />
    );
  }

  return (
    <AssetForm
      action={create.submit}
      submitLabel={t("createSubmit")}
      submitPendingLabel={t("createSubmitPending")}
      options={options}
      extraSection={
        <FirstPhotoField
          photo={create.photo}
          phase={create.phase}
          progress={create.progress}
          onPick={create.pickPhoto}
          onClear={create.clearPhoto}
          onCancel={create.cancelUpload}
        />
      }
    />
  );
}
