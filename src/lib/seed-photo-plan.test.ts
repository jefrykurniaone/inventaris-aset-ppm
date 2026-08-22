import { describe, expect, it } from "vitest";

import { seedPhotoFileNames, seedPhotoVariantFor } from "./seed-photo-plan";

describe("seedPhotoVariantFor", () => {
  it("is 'a' for the first photo and 'b' for the second", () => {
    expect(seedPhotoVariantFor(0)).toBe("a");
    expect(seedPhotoVariantFor(1)).toBe("b");
  });
});

describe("seedPhotoFileNames", () => {
  it("names the full image and thumbnail for the category and variant", () => {
    expect(seedPhotoFileNames("LAB", 0)).toEqual({
      full: "LAB-a-full.jpg",
      thumb: "LAB-a-thumb.jpg",
    });
    expect(seedPhotoFileNames("LAB", 1)).toEqual({
      full: "LAB-b-full.jpg",
      thumb: "LAB-b-thumb.jpg",
    });
  });
});
