"use client";

import Image from "next/image";
import type { KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import type { AssetPhotoView } from "../photos/queries";

/**
 * The full-size photo lightbox (issue #10's acceptance criterion: "keyboard
 * operable and dismissible with Escape"). Built on the plain `Dialog`
 * primitive in `src/components/ui/dialog.tsx`, which is Radix under it —
 * Escape-to-close and a trapped focus come from the primitive, not from
 * anything written here. Arrow-key navigation between photos is the one
 * piece this component adds.
 */

const LIGHTBOX_IMAGE_SIZES = "100vw";

interface PhotoLightboxProps {
  readonly photos: readonly AssetPhotoView[];
  readonly altTexts: readonly string[];
  readonly counters: readonly string[];
  readonly closeLabel: string;
  readonly previousLabel: string;
  readonly nextLabel: string;
  readonly openIndex: number | null;
  readonly onOpenIndexChange: (index: number | null) => void;
}

export function PhotoLightbox({
  photos,
  altTexts,
  counters,
  closeLabel,
  previousLabel,
  nextLabel,
  openIndex,
  onOpenIndexChange,
}: Readonly<PhotoLightboxProps>) {
  const isOpen = openIndex !== null;
  const currentIndex = openIndex ?? 0;
  const photoCount = photos.length;

  function step(offset: number): void {
    onOpenIndexChange((currentIndex + offset + photoCount) % photoCount);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "ArrowLeft") {
      step(-1);
    } else if (event.key === "ArrowRight") {
      step(1);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => onOpenIndexChange(open ? currentIndex : null)}
    >
      <DialogContent className="max-w-3xl" onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between gap-2">
          <DialogTitle className="text-sm font-normal">
            {counters[currentIndex]}
          </DialogTitle>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              {closeLabel}
            </Button>
          </DialogClose>
        </div>
        <div className="relative h-[60vh] w-full">
          <Image
            src={photos[currentIndex]?.url ?? ""}
            alt={altTexts[currentIndex] ?? ""}
            fill
            sizes={LIGHTBOX_IMAGE_SIZES}
            unoptimized
            className="object-contain"
          />
        </div>
        {photoCount > 1 ? (
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => step(-1)}>
              {previousLabel}
            </Button>
            <Button type="button" variant="outline" onClick={() => step(1)}>
              {nextLabel}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
