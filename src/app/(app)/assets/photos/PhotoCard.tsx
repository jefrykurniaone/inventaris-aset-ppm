"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { THUMBNAIL_MAX_EDGE_PX } from "@/lib/photo-compression";

import type { AssetPhotoView } from "./queries";

/**
 * One photo in the manager: its thumbnail, whether it is the primary, and the
 * three things that can be done to it.
 *
 * Ordering is two buttons rather than drag and drop. Dragging is not
 * keyboard-operable, and WCAG AA requires that every action be — a
 * drag-and-drop grid with a hidden keyboard fallback is two implementations of
 * the same feature, of which only one ever gets tested.
 *
 * The thumbnail is `unoptimized`: it is already a 400 px WebP produced by the
 * browser before upload, so Next's optimiser would re-encode an
 * already-optimal image and route every render through a serverless function
 * — the exact egress cost PRD risk R2 asks the pipeline to avoid.
 */

interface PhotoCardProps {
  readonly photo: AssetPhotoView;
  readonly altText: string;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isBusy: boolean;
  readonly onSetPrimary: () => void;
  readonly onMoveEarlier: () => void;
  readonly onMoveLater: () => void;
  readonly onDelete: () => void;
}

export function PhotoCard({
  photo,
  altText,
  isFirst,
  isLast,
  isBusy,
  onSetPrimary,
  onMoveEarlier,
  onMoveLater,
  onDelete,
}: Readonly<PhotoCardProps>) {
  const t = useTranslations("AssetPhotos");

  return (
    <li className="border-border flex flex-col gap-3 rounded-md border p-3">
      <Image
        src={photo.thumbnailUrl}
        alt={altText}
        width={THUMBNAIL_MAX_EDGE_PX}
        height={THUMBNAIL_MAX_EDGE_PX}
        unoptimized
        className="bg-muted h-40 w-full rounded object-cover"
      />
      {photo.isPrimary ? (
        <Badge>{t("primaryBadge")}</Badge>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={onSetPrimary}
        >
          {t("setPrimary")}
        </Button>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy || isFirst}
          onClick={onMoveEarlier}
        >
          {t("moveEarlier")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy || isLast}
          onClick={onMoveLater}
        >
          {t("moveLater")}
        </Button>
      </div>
      <ConfirmDialog
        trigger={
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isBusy}
          >
            {t("deletePhoto")}
          </Button>
        }
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        cancelLabel={t("deleteCancel")}
        confirmLabel={t("deleteConfirm")}
        action={onDelete}
        hiddenFields={{}}
      />
    </li>
  );
}
