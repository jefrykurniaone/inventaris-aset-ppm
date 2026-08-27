"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import { PhotoUploadControl } from "../photos/PhotoUploadControl";
import type { PhotoUploadPhase } from "../photos/run-photo-upload";

/**
 * The optional first photo on the create form (issue #85, PRD FR-4.2).
 *
 * `PhotoUploadControl` is reused exactly as the edit page uses it — the same
 * two native file inputs, the same accessible progress bar and cancel button
 * — but `onPick` here only remembers the file. Nothing is compressed or
 * uploaded until the asset has been created and has an id to key its objects
 * on, so the picked name is echoed back with a way to drop it again.
 *
 * `useFormStatus` reads the enclosing `<form>`, which this is rendered inside
 * through `AssetForm`'s `extraSection` slot. One submission covers the create
 * round trip and the upload that follows it, so `pending` stays true for the
 * whole flow and the controls stay locked for all of it.
 */

interface FirstPhotoFieldProps {
  readonly photo: File | null;
  readonly phase: PhotoUploadPhase;
  readonly progress: number;
  readonly onPick: (file: File) => void;
  readonly onClear: () => void;
  readonly onCancel: () => void;
}

export function FirstPhotoField({
  photo,
  phase,
  progress,
  onPick,
  onClear,
  onCancel,
}: Readonly<FirstPhotoFieldProps>) {
  const t = useTranslations("AssetsPage");
  const { pending } = useFormStatus();

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-lg font-medium">{t("sectionPhoto")}</legend>
      <p className="text-muted-foreground text-sm">{t("sectionPhotoNote")}</p>
      <PhotoUploadControl
        phase={phase}
        progress={progress}
        isBusy={pending}
        isFull={false}
        onPick={onPick}
        onCancel={onCancel}
      />
      {photo && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">
            {t("photoSelected", { name: photo.name })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onClear}
          >
            {t("photoClear")}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
