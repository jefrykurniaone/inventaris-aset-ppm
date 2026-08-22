import { describe, expect, it } from "vitest";

import {
  acceptPhoto,
  buildPhotoObjectPath,
  isHeicFile,
  isPhotoContentType,
  isPhotoObjectPathFor,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_ASSET,
  photoExtensionFor,
  photoObjectPrefix,
  PHOTO_CONTENT_TYPES,
  PHOTO_OBJECT_ID_LENGTH,
} from "./photo-upload";

const ASSET_ID = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const OTHER_ASSET_ID = "0199ffff-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

describe("the photo content-type allowlist", () => {
  it.each(PHOTO_CONTENT_TYPES)("accepts %s", (contentType) => {
    expect(isPhotoContentType(contentType)).toBe(true);
  });

  it.each([
    "image/heic",
    "image/heif",
    "image/gif",
    "image/svg+xml",
    "application/pdf",
    "text/html",
    "",
    "IMAGE/JPEG",
  ])("refuses %s", (contentType) => {
    expect(isPhotoContentType(contentType)).toBe(false);
  });

  it("maps each allowed type to one file extension", () => {
    expect(PHOTO_CONTENT_TYPES.map(photoExtensionFor)).toEqual([
      "jpg",
      "png",
      "webp",
    ]);
  });
});

describe("acceptPhoto", () => {
  it("accepts a compressed WebP of the size the pipeline actually produces", () => {
    expect(
      acceptPhoto({ contentType: "image/webp", sizeBytes: 400_000 }),
    ).toEqual({
      isAccepted: true,
      contentType: "image/webp",
      sizeBytes: 400_000,
    });
  });

  it("accepts an upload of exactly the maximum, so the cap is inclusive", () => {
    expect(
      acceptPhoto({ contentType: "image/webp", sizeBytes: MAX_PHOTO_BYTES })
        .isAccepted,
    ).toBe(true);
  });

  it("refuses one byte over the maximum", () => {
    expect(
      acceptPhoto({
        contentType: "image/webp",
        sizeBytes: MAX_PHOTO_BYTES + 1,
      }),
    ).toEqual({ isAccepted: false, rejection: "TOO_LARGE" });
  });

  it("refuses a raw phone photo that skipped compression entirely", () => {
    expect(
      acceptPhoto({ contentType: "image/jpeg", sizeBytes: 5_200_000 }),
    ).toEqual({ isAccepted: false, rejection: "TOO_LARGE" });
  });

  it.each(["image/heic", "image/gif", "application/pdf", ""])(
    "refuses %s as an unsupported type",
    (contentType) => {
      expect(acceptPhoto({ contentType, sizeBytes: 1_000 })).toEqual({
        isAccepted: false,
        rejection: "UNSUPPORTED_TYPE",
      });
    },
  );

  it.each([0, -1, 1.5, Number.NaN])(
    "refuses a size of %s as an empty upload",
    (sizeBytes) => {
      expect(acceptPhoto({ contentType: "image/webp", sizeBytes })).toEqual({
        isAccepted: false,
        rejection: "EMPTY",
      });
    },
  );

  it("reports the type before the size, so a disallowed huge file names the type", () => {
    expect(
      acceptPhoto({ contentType: "image/heic", sizeBytes: 9_000_000 }),
    ).toEqual({ isAccepted: false, rejection: "UNSUPPORTED_TYPE" });
  });
});

describe("isHeicFile", () => {
  it.each(["image/heic", "image/heif", "IMAGE/HEIC"])(
    "recognises the reported type %s",
    (contentType) => {
      expect(isHeicFile("photo.bin", contentType)).toBe(true);
    },
  );

  it.each(["IMG_0042.HEIC", "img.heif", "scan.heic"])(
    "recognises %s by name when the browser reports no type at all",
    (fileName) => {
      expect(isHeicFile(fileName, "")).toBe(true);
    },
  );

  it("does not mistake a JPEG for HEIC", () => {
    expect(isHeicFile("IMG_0042.jpg", "image/jpeg")).toBe(false);
  });

  it("does not match a name that merely mentions heic", () => {
    expect(isHeicFile("heic-converted.png", "image/png")).toBe(false);
  });
});

describe("buildPhotoObjectPath", () => {
  it("puts the object at assets/<assetId>/<nanoid>.<ext>", () => {
    const objectPath = buildPhotoObjectPath(ASSET_ID, "image/webp");

    expect(objectPath.startsWith(`assets/${ASSET_ID}/`)).toBe(true);
    expect(objectPath.endsWith(".webp")).toBe(true);
    expect(isPhotoObjectPathFor(ASSET_ID, objectPath)).toBe(true);
  });

  it("takes the extension from the allowlist, not from any file name", () => {
    expect(buildPhotoObjectPath(ASSET_ID, "image/jpeg").endsWith(".jpg")).toBe(
      true,
    );
  });

  it("mints a distinct object name every time, so two uploads never collide", () => {
    const paths = new Set(
      Array.from({ length: 50 }, () =>
        buildPhotoObjectPath(ASSET_ID, "image/webp"),
      ),
    );

    expect(paths.size).toBe(50);
  });

  it("uses an object name of the declared length", () => {
    const objectPath = buildPhotoObjectPath(ASSET_ID, "image/png");
    const objectName = objectPath.slice(photoObjectPrefix(ASSET_ID).length);

    expect(objectName).toHaveLength(PHOTO_OBJECT_ID_LENGTH + ".png".length);
  });
});

describe("isPhotoObjectPathFor", () => {
  const validPath = buildPhotoObjectPath(ASSET_ID, "image/webp");

  it("accepts a path this application minted for the same asset", () => {
    expect(isPhotoObjectPathFor(ASSET_ID, validPath)).toBe(true);
  });

  it("refuses another asset's photo, so a caller cannot reach across assets", () => {
    expect(isPhotoObjectPathFor(OTHER_ASSET_ID, validPath)).toBe(false);
  });

  it.each([
    ["assets/../secrets.webp", "a traversal out of the asset folder"],
    ["assets/0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/../x.webp", "a traversal"],
    ["assets/0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/short.webp", "a short name"],
    ["assets/0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/abcdefghijklmnop", "no dot"],
    [
      "assets/0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/abcdefghijklmnop.svg",
      "an extension outside the allowlist",
    ],
    [
      "assets/0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/abcdefghijklmno/.webp",
      "a slash inside the object name",
    ],
    ["other/0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/abcdefghijklmnop.webp", "a"],
    ["", "an empty path"],
  ])("refuses %s — %s", (objectPath) => {
    expect(isPhotoObjectPathFor(ASSET_ID, objectPath)).toBe(false);
  });
});

describe("the per-asset limit", () => {
  it("is five (FR-4.1)", () => {
    expect(MAX_PHOTOS_PER_ASSET).toBe(5);
  });
});
