import { describe, expect, it } from "vitest";

import {
  isPhotoVariant,
  photoAddress,
  photoUploadAddress,
  PHOTO_VARIANTS,
} from "./photo-address";

const PHOTO_ID = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const ASSET_ID = "0199ffff-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

describe("photoAddress", () => {
  it.each([
    ["full", `/api/photos/${PHOTO_ID}/full`],
    ["thumb", `/api/photos/${PHOTO_ID}/thumb`],
  ] as const)(
    "serves the %s variant from the application's own route",
    (variant, expected) => {
      expect(photoAddress(PHOTO_ID, variant)).toBe(expected);
    },
  );

  it("gives the two variants of one photo two different addresses", () => {
    expect(photoAddress(PHOTO_ID, "full")).not.toBe(
      photoAddress(PHOTO_ID, "thumb"),
    );
  });

  it("encodes the id, so no value can add or climb a path segment", () => {
    expect(photoAddress("../x/y", "full")).toBe("/api/photos/..%2Fx%2Fy/full");
  });
});

describe("photoUploadAddress", () => {
  it("posts to the asset's photo collection", () => {
    expect(photoUploadAddress(ASSET_ID)).toBe(`/api/assets/${ASSET_ID}/photos`);
  });

  it("encodes the asset id as well", () => {
    expect(photoUploadAddress("a/b")).toBe("/api/assets/a%2Fb/photos");
  });
});

describe("isPhotoVariant", () => {
  it.each(PHOTO_VARIANTS)("accepts %s", (variant) => {
    expect(isPhotoVariant(variant)).toBe(true);
  });

  it.each(["thumbnail", "FULL", "", "original"])("refuses %s", (value) => {
    expect(isPhotoVariant(value)).toBe(false);
  });
});
