"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { FormError } from "@/components/FormError";
import { MAX_PHOTOS_PER_ASSET } from "@/lib/photo-upload";

import {
  deletePhotoAction,
  reorderPhotosAction,
  setPrimaryPhotoAction,
} from "./actions";
import { PhotoCard } from "./PhotoCard";
import { PhotoUploadControl } from "./PhotoUploadControl";
import type { AssetPhotoView } from "./queries";
import type { PhotoActionResult } from "./schemas";
import { usePhotoUpload } from "./use-photo-upload";

/**
 * The photo section of the asset edit page (PRD FR-4.1 to FR-4.9).
 *
 * Uploading has its own state machine in `usePhotoUpload`, because it is long
 * running and cancellable. The other three operations are single round trips,
 * so they share one `useTransition` and one error line — a per-card pending
 * state would be four spinners for something that takes a few hundred
 * milliseconds.
 *
 * Every button here is a courtesy. Each action re-checks the session and the
 * ownership of what it is asked to change, so hiding a control is never what
 * makes an operation unavailable.
 */

interface PhotoManagerProps {
  readonly assetId: string;
  readonly assetName: string;
  readonly categoryName: string;
  readonly photos: readonly AssetPhotoView[];
}

/** Swaps the photo at `index` with its neighbour and returns the new id
 * order. `offset` is -1 to move earlier and +1 to move later. */
function reorderedIds(
  photos: readonly AssetPhotoView[],
  index: number,
  offset: number,
): readonly string[] {
  const ids = photos.map((photo) => photo.id);
  const target = index + offset;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}

export function PhotoManager({
  assetId,
  assetName,
  categoryName,
  photos,
}: Readonly<PhotoManagerProps>) {
  const t = useTranslations("AssetPhotos");
  const router = useRouter();
  const upload = usePhotoUpload(assetId);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const isBusy = upload.isBusy || isPending;

  function run(action: () => Promise<PhotoActionResult<undefined>>): void {
    setActionError(null);
    startTransition(async () => {
      const result = await action();
      setActionError(result.ok ? null : result.message);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <section
      aria-labelledby="asset-photos-heading"
      className="flex flex-col gap-4"
    >
      <h2 id="asset-photos-heading" className="text-lg font-semibold">
        {t("sectionTitle")}
      </h2>
      <p className="text-muted-foreground text-sm">
        {t("sectionNote", { max: MAX_PHOTOS_PER_ASSET })}
      </p>

      <PhotoUploadControl
        phase={upload.phase}
        progress={upload.progress}
        isBusy={isBusy}
        isFull={photos.length >= MAX_PHOTOS_PER_ASSET}
        onPick={upload.start}
        onCancel={upload.cancel}
      />

      <FormError message={upload.errorMessage} />
      <FormError message={actionError} />

      {photos.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("emptyState")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              altText={t("photoAlt", {
                name: assetName,
                category: categoryName,
                position: index + 1,
              })}
              isFirst={index === 0}
              isLast={index === photos.length - 1}
              isBusy={isBusy}
              onSetPrimary={() =>
                run(() => setPrimaryPhotoAction({ assetId, photoId: photo.id }))
              }
              onMoveEarlier={() =>
                run(() =>
                  reorderPhotosAction({
                    assetId,
                    photoIds: reorderedIds(photos, index, -1),
                  }),
                )
              }
              onMoveLater={() =>
                run(() =>
                  reorderPhotosAction({
                    assetId,
                    photoIds: reorderedIds(photos, index, 1),
                  }),
                )
              }
              onDelete={() =>
                run(() => deletePhotoAction({ assetId, photoId: photo.id }))
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}
