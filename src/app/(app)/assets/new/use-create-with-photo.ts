"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

import { ASSETS_PATH } from "@/lib/paths";

import { createAssetAction } from "../actions";
import {
  runPhotoUpload,
  type PhotoUploadPhase,
  type RunPhotoUploadResult,
} from "../photos/run-photo-upload";
import type { AssetFormState } from "../schemas";

import {
  nextCreateStep,
  nextPhotoStep,
  type PhotoFailure,
} from "./create-flow";

/**
 * The create form's own submit handler: create the asset, then — if the user
 * picked one — attach its first photo before navigating (issue #85).
 *
 * The photo never enters the `FormData` the server action receives. It is
 * held here as a `File` and handed to the same `runPhotoUpload` the edit page
 * uses, which compresses in the browser, asks the server for signed targets,
 * and uploads straight to storage. No image byte passes through a server
 * function, and the object path is still built server-side from the asset id.
 *
 * The branching lives in `create-flow.ts`; this owns `next-intl`, the router
 * and the abort controller.
 */

const NO_PROGRESS = 0;

export interface CreateWithPhotoController {
  readonly photo: File | null;
  readonly phase: PhotoUploadPhase;
  /** 0 to 1. Meaningful only while `phase` is not `"idle"`. */
  readonly progress: number;
  /** Set once an asset was created whose photo was not stored. */
  readonly failure: PhotoFailure | null;
  readonly submit: (
    state: AssetFormState,
    formData: FormData,
  ) => Promise<AssetFormState>;
  readonly pickPhoto: (file: File) => void;
  readonly clearPhoto: () => void;
  readonly cancelUpload: () => void;
}

export function useCreateWithPhoto(): CreateWithPhotoController {
  const t = useTranslations("AssetPhotos");
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  // The asset this form has already written, so a second submission navigates
  // rather than registering the same item twice. React queues actions, so a
  // submit that arrives while the first is still uploading runs afterwards
  // and would otherwise reach `createAsset` a second time.
  const createdRef = useRef<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [phase, setPhase] = useState<PhotoUploadPhase>("idle");
  const [progress, setProgress] = useState(NO_PROGRESS);
  const [failure, setFailure] = useState<PhotoFailure | null>(null);

  const uploadPhoto = useCallback(
    async (assetId: string, file: File): Promise<RunPhotoUploadResult> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress(NO_PROGRESS);
      setPhase("preparing");
      try {
        return await runPhotoUpload({
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
        });
      } finally {
        abortRef.current = null;
        setPhase("idle");
      }
    },
    [t],
  );

  const submit = useCallback(
    async (
      state: AssetFormState,
      formData: FormData,
    ): Promise<AssetFormState> => {
      if (createdRef.current !== null) {
        router.push(ASSETS_PATH);
        return state;
      }

      const created = await createAssetAction(state, formData);
      const step = nextCreateStep(created, photo);
      if (step.kind === "rejected") {
        return created;
      }

      createdRef.current = step.assetId;
      if (step.kind === "navigate") {
        router.push(ASSETS_PATH);
        return created;
      }

      const uploaded = await uploadPhoto(step.assetId, step.photo);
      const outcome = nextPhotoStep(step.assetId, uploaded);
      if (outcome.kind === "navigate") {
        router.push(ASSETS_PATH);
      } else {
        setFailure(outcome.failure);
      }
      return created;
    },
    [photo, router, uploadPhoto],
  );

  const pickPhoto = useCallback((file: File) => setPhoto(file), []);
  const clearPhoto = useCallback(() => setPhoto(null), []);
  const cancelUpload = useCallback(() => abortRef.current?.abort(), []);

  return {
    photo,
    phase,
    progress,
    failure,
    submit,
    pickPhoto,
    clearPhoto,
    cancelUpload,
  };
}
