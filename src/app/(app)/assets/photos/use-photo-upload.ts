"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

import {
  runPhotoUpload,
  type PhotoUploadPhase,
  type RunPhotoUploadResult,
} from "./run-photo-upload";

/**
 * React state around `runPhotoUpload`: which phase the upload is in, how far
 * it has got, whether it can be cancelled, and what to say when it fails.
 *
 * The hook owns `next-intl` and the router refresh; the sequence itself lives
 * in `run-photo-upload.ts` and knows about neither.
 */

const NO_PROGRESS = 0;
const FULL_PROGRESS = 1;

export interface PhotoUploadController {
  readonly phase: PhotoUploadPhase;
  /** 0 to 1. Meaningful only while `phase` is not `"idle"`. */
  readonly progress: number;
  readonly errorMessage: string | null;
  readonly isBusy: boolean;
  start: (file: File) => void;
  cancel: () => void;
  dismissError: () => void;
}

export function usePhotoUpload(assetId: string): PhotoUploadController {
  const t = useTranslations("AssetPhotos");
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<PhotoUploadPhase>("idle");
  const [progress, setProgress] = useState(NO_PROGRESS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const settle = useCallback(
    (result: RunPhotoUploadResult) => {
      abortRef.current = null;
      setPhase("idle");
      setProgress(NO_PROGRESS);
      setErrorMessage(result.ok ? null : result.message);
      if (result.ok) {
        setProgress(FULL_PROGRESS);
        router.refresh();
      }
    },
    [router],
  );

  const start = useCallback(
    (file: File) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setErrorMessage(null);
      setProgress(NO_PROGRESS);
      setPhase("preparing");

      void runPhotoUpload({
        assetId,
        file,
        origin: globalThis.location.origin,
        signal: controller.signal,
        onProgress: setProgress,
        onPhase: setPhase,
        messages: {
          heicNotSupported: t("heicNotSupported"),
          unsupportedFormat: t("unsupportedFormat"),
          uploadFailed: t("uploadFailed"),
        },
      }).then(settle, () => settle({ ok: false, message: t("uploadFailed") }));
    },
    [assetId, settle, t],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const dismissError = useCallback(() => setErrorMessage(null), []);

  return {
    phase,
    progress,
    errorMessage,
    isBusy: phase !== "idle",
    start,
    cancel,
    dismissError,
  };
}
