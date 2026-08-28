import { describe, expect, it } from "vitest";

import { buildMissingPhotoWhere, isMissingPhoto } from "./asset-missing-photo";

describe("buildMissingPhotoWhere", () => {
  it("expresses the missing-photo rule as a no-photo relation filter", () => {
    expect(buildMissingPhotoWhere()).toEqual({
      photos: { none: {} },
    });
  });
});

describe("isMissingPhoto", () => {
  it("is true for an asset with no photo attached", () => {
    expect(isMissingPhoto({ hasPhoto: false })).toBe(true);
  });

  it("is false for an asset with a photo attached", () => {
    expect(isMissingPhoto({ hasPhoto: true })).toBe(false);
  });
});
