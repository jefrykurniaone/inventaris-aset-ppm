"use client";

import { useTranslations } from "next-intl";
import { useId, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { PHOTO_CONTENT_TYPES } from "@/lib/photo-upload";

import type { PhotoUploadPhase } from "./run-photo-upload";

/**
 * Picking a photo (PRD FR-4.2, FR-4.3).
 *
 * Two real `<input type="file">` controls rather than buttons that click a
 * hidden input: a file input is focusable and operable from the keyboard on
 * its own, and the usual `display: none` trick removes it from the tab order
 * entirely. They are styled with Tailwind's `file:` variant so they look like
 * the rest of the form while staying native.
 *
 * Two of them, because FR-4.2 asks for camera capture **as well as** file
 * selection and `capture` is not a toggle: an input carrying
 * `capture="environment"` opens the rear camera directly on a phone and
 * offers nothing else. One input with `capture` would take file selection
 * away on exactly the devices the feature is for. On a desktop browser
 * `capture` is ignored and the second control is simply a second file picker,
 * which is harmless and is why it is labelled for what it does on a phone.
 *
 * `accept` names the allowed types and HEIC as well. Listing HEIC is
 * deliberate: excluding it makes the file greyed out in the picker with no
 * explanation, whereas accepting it lets the file through to the check that
 * says why it cannot be used (FR-4.8).
 */

const ACCEPTED_PICKER_TYPES = [
  ...PHOTO_CONTENT_TYPES,
  "image/heic",
  "image/heif",
].join(",");

const PROGRESS_MAX = 100;

const FILE_INPUT_CLASS =
  "text-foreground file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 focus-visible:ring-ring block w-full cursor-pointer rounded-md text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

interface PhotoUploadControlProps {
  readonly phase: PhotoUploadPhase;
  readonly progress: number;
  readonly isBusy: boolean;
  readonly isFull: boolean;
  readonly onPick: (file: File) => void;
  readonly onCancel: () => void;
}

const PHASE_LABEL_KEYS = {
  idle: "phaseIdle",
  preparing: "phasePreparing",
  uploading: "phaseUploading",
  saving: "phaseSaving",
} as const;

export function PhotoUploadControl({
  phase,
  progress,
  isBusy,
  isFull,
  onPick,
  onCancel,
}: Readonly<PhotoUploadControlProps>) {
  const t = useTranslations("AssetPhotos");
  const chooseId = useId();
  const captureId = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice in a row still fires a change.
    event.target.value = "";
    if (file) {
      onPick(file);
    }
  }

  if (isFull) {
    return <p className="text-muted-foreground text-sm">{t("limitReached")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={chooseId} className="text-sm font-medium">
            {t("chooseFileLabel")}
          </label>
          <input
            id={chooseId}
            type="file"
            accept={ACCEPTED_PICKER_TYPES}
            disabled={isBusy}
            onChange={handleChange}
            className={FILE_INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={captureId} className="text-sm font-medium">
            {t("takePhotoLabel")}
          </label>
          <input
            id={captureId}
            type="file"
            accept={ACCEPTED_PICKER_TYPES}
            capture="environment"
            disabled={isBusy}
            onChange={handleChange}
            className={FILE_INPUT_CLASS}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-sm">{t("uploadHint")}</p>
      {isBusy && (
        <UploadProgress
          label={t(PHASE_LABEL_KEYS[phase])}
          progress={progress}
          cancelLabel={t("cancelUpload")}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

interface UploadProgressProps {
  readonly label: string;
  readonly progress: number;
  readonly cancelLabel: string;
  readonly onCancel: () => void;
}

/** A native `<progress>`, which announces its value to assistive technology
 * without any ARIA of its own — semantic element before role (`CLAUDE.md`). */
function UploadProgress({
  label,
  progress,
  cancelLabel,
  onCancel,
}: Readonly<UploadProgressProps>) {
  const progressId = useId();

  return (
    <div className="flex items-center gap-3">
      <label htmlFor={progressId} className="text-sm">
        {label}
      </label>
      <progress
        id={progressId}
        className="h-2 flex-1"
        max={PROGRESS_MAX}
        value={Math.round(progress * PROGRESS_MAX)}
      />
      <Button type="button" variant="outline" size="sm" onClick={onCancel}>
        {cancelLabel}
      </Button>
    </div>
  );
}
