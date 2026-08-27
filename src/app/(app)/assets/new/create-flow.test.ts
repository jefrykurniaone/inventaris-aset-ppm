import { describe, expect, it } from "vitest";

import { INITIAL_ASSET_FORM_STATE, type AssetFormState } from "../schemas";

import { nextCreateStep, nextPhotoStep } from "./create-flow";

const ASSET_ID = "asset-1";
const OTHER_ASSET_ID = "asset-2";

function pickedPhoto(): File {
  return new File(["pixel"], "photo.webp", { type: "image/webp" });
}

function createdState(): AssetFormState {
  return {
    fieldErrors: {},
    formError: null,
    isSuccess: true,
    createdAssetId: ASSET_ID,
  };
}

describe("nextCreateStep", () => {
  it("keeps the user on the form when the submission was rejected, photo or not", () => {
    const rejected: AssetFormState = {
      fieldErrors: { name: "Asset name is required." },
      formError: null,
      isSuccess: false,
    };

    expect(nextCreateStep(rejected, null)).toEqual({ kind: "rejected" });
    expect(nextCreateStep(rejected, pickedPhoto())).toEqual({
      kind: "rejected",
    });
  });

  it("treats the untouched initial state as a rejection rather than a create", () => {
    expect(nextCreateStep(INITIAL_ASSET_FORM_STATE, null)).toEqual({
      kind: "rejected",
    });
  });

  it("navigates straight away when the asset was created without a photo", () => {
    expect(nextCreateStep(createdState(), null)).toEqual({
      kind: "navigate",
      assetId: ASSET_ID,
    });
  });

  it("uploads the picked photo against the id the create action returned", () => {
    const photo = pickedPhoto();

    expect(nextCreateStep(createdState(), photo)).toEqual({
      kind: "upload",
      assetId: ASSET_ID,
      photo,
    });
  });

  it("refuses to upload against a success that carries no id", () => {
    const idless: AssetFormState = {
      fieldErrors: {},
      formError: null,
      isSuccess: true,
    };

    expect(nextCreateStep(idless, pickedPhoto())).toEqual({ kind: "rejected" });
  });
});

describe("nextPhotoStep", () => {
  it("navigates once the photo has been stored", () => {
    expect(nextPhotoStep(ASSET_ID, { ok: true })).toEqual({ kind: "navigate" });
  });

  it("keeps the created asset and its localised reason when the upload failed", () => {
    const message = "The photo could not be uploaded.";

    expect(nextPhotoStep(ASSET_ID, { ok: false, message })).toEqual({
      kind: "failed",
      failure: { assetId: ASSET_ID, reason: message },
    });
  });

  it("reports a cancelled upload as a failure with nothing to say", () => {
    expect(nextPhotoStep(ASSET_ID, { ok: false, message: null })).toEqual({
      kind: "failed",
      failure: { assetId: ASSET_ID, reason: null },
    });
  });

  it("points the failure at the asset it was given, not at any other", () => {
    const step = nextPhotoStep(OTHER_ASSET_ID, { ok: false, message: "no" });

    expect(step).toEqual({
      kind: "failed",
      failure: { assetId: OTHER_ASSET_ID, reason: "no" },
    });
  });
});
