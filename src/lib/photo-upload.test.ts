import { describe, expect, it } from "vitest";

import {
  acceptPhoto,
  detectPhotoContentType,
  inspectPhotoPart,
  isHeicFile,
  isPhotoContentType,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_ASSET,
  MAX_UPLOAD_BODY_BYTES,
  PHOTO_CONTENT_TYPES,
} from "./photo-upload";

/** The smallest headers each detector has to recognise, padded with a few
 * arbitrary bytes so that a match is not an accident of length. */
const JPEG_BYTES = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const PNG_BYTES = Uint8Array.of(
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
  0x00,
);
function ascii(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

/** A RIFF chunk size, little-endian. Its value is irrelevant to detection. */
const RIFF_SIZE = [0x24, 0x00, 0x00, 0x00];
const WEBP_BYTES = Uint8Array.from([
  ...ascii("RIFF"),
  ...RIFF_SIZE,
  ...ascii("WEBPVP8 "),
]);
const WAV_BYTES = Uint8Array.from([
  ...ascii("RIFF"),
  ...RIFF_SIZE,
  ...ascii("WAVEfmt "),
]);
const GIF_BYTES = Uint8Array.from([...ascii("GIF89a"), 0x01, 0x00]);
const TEXT_BYTES = new TextEncoder().encode(
  "this is a text file, not an image",
);

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
});

describe("detectPhotoContentType", () => {
  it.each([
    [JPEG_BYTES, "image/jpeg"],
    [PNG_BYTES, "image/png"],
    [WEBP_BYTES, "image/webp"],
  ] as const)("recognises an allowed signature as %s", (bytes, expected) => {
    expect(detectPhotoContentType(bytes)).toBe(expected);
  });

  it.each([
    ["two bytes of a JPEG marker", Uint8Array.of(0xff, 0xd8)],
    ["the first half of a PNG signature", PNG_BYTES.slice(0, 4)],
    ["RIFF and a size, cut before the form type", WEBP_BYTES.slice(0, 10)],
    ["nothing at all", new Uint8Array(0)],
  ])("returns null for a truncated header: %s", (_label, bytes) => {
    expect(detectPhotoContentType(bytes)).toBeNull();
  });

  it.each([
    ["plain text", TEXT_BYTES],
    ["a WAV file, which is RIFF but not WebP", WAV_BYTES],
    ["a GIF", GIF_BYTES],
    [
      "a JPEG signature that starts one byte late",
      Uint8Array.of(0, 0xff, 0xd8, 0xff),
    ],
  ])("returns null for %s", (_label, bytes) => {
    expect(detectPhotoContentType(bytes)).toBeNull();
  });
});

describe("inspectPhotoPart", () => {
  it.each([
    [JPEG_BYTES, "image/jpeg"],
    [PNG_BYTES, "image/png"],
    [WEBP_BYTES, "image/webp"],
  ] as const)(
    "accepts bytes that are what they say they are (%#)",
    (bytes, declaredType) => {
      expect(inspectPhotoPart({ declaredType, bytes })).toEqual({
        isAccepted: true,
        contentType: declaredType,
        sizeBytes: bytes.length,
      });
    },
  );

  it("refuses text declared as image/webp as an unsupported format", () => {
    expect(
      inspectPhotoPart({ declaredType: "image/webp", bytes: TEXT_BYTES }),
    ).toEqual({ isAccepted: false, rejection: "UNSUPPORTED_TYPE" });
  });

  it.each([
    ["a JPEG declared as WebP", JPEG_BYTES, "image/webp"],
    ["a WebP declared as PNG", WEBP_BYTES, "image/png"],
    ["a PNG declared as nothing", PNG_BYTES, ""],
    ["a JPEG declared in capitals", JPEG_BYTES, "IMAGE/JPEG"],
  ])(
    "refuses a lie in the declared type: %s",
    (_label, bytes, declaredType) => {
      expect(inspectPhotoPart({ declaredType, bytes })).toEqual({
        isAccepted: false,
        rejection: "UNSUPPORTED_TYPE",
      });
    },
  );

  it("refuses an empty part as an incomplete upload, before any type check", () => {
    expect(
      inspectPhotoPart({
        declaredType: "image/webp",
        bytes: new Uint8Array(0),
      }),
    ).toEqual({ isAccepted: false, rejection: "EMPTY" });
  });

  it("measures the size itself and refuses one byte over the ceiling", () => {
    const bytes = new Uint8Array(MAX_PHOTO_BYTES + 1);
    bytes.set(JPEG_BYTES);

    expect(inspectPhotoPart({ declaredType: "image/jpeg", bytes })).toEqual({
      isAccepted: false,
      rejection: "TOO_LARGE",
    });
  });

  it("accepts a part of exactly the ceiling, so the cap is inclusive", () => {
    const bytes = new Uint8Array(MAX_PHOTO_BYTES);
    bytes.set(JPEG_BYTES);

    expect(
      inspectPhotoPart({ declaredType: "image/jpeg", bytes }).isAccepted,
    ).toBe(true);
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

describe("the upload body cap", () => {
  it("is 3.2 MB: two derivatives at the per-photo ceiling plus framing", () => {
    expect(MAX_UPLOAD_BODY_BYTES).toBe(3_200_000);
  });

  it("fits two full-size derivatives, so an honest upload is never refused for its size", () => {
    expect(MAX_UPLOAD_BODY_BYTES).toBeGreaterThan(2 * MAX_PHOTO_BYTES);
  });

  it("stays under the 4.5 MB request limit of serverless hosts", () => {
    expect(MAX_UPLOAD_BODY_BYTES).toBeLessThan(4_500_000);
  });
});

describe("the per-asset limit", () => {
  it("is five (FR-4.1)", () => {
    expect(MAX_PHOTOS_PER_ASSET).toBe(5);
  });
});
