import { describe, expect, it } from "vitest";

import {
  hasPhotoSignature,
  PhotoPreparationError,
  preparePhoto,
} from "./prepare-photo";

/**
 * The browser-side refusals that happen before any compression runs. The
 * compression itself needs a canvas and a Web Worker, so it is the runtime
 * walk's to prove; what is asserted here is that a file which is not an image
 * is named as an unsupported format rather than reaching the compressor.
 */

const ORIGIN = "http://localhost:3000";

function file(bytes: readonly number[], name: string, type: string): File {
  return new File([Uint8Array.from(bytes)], name, { type });
}

function ascii(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46];
const WEBP_HEAD = [...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WEBPVP8 ")];

describe("hasPhotoSignature", () => {
  it.each([
    ["a JPEG", JPEG_HEAD],
    ["a WebP", WEBP_HEAD],
  ])("recognises %s from its leading bytes", async (_label, bytes) => {
    await expect(hasPhotoSignature(file(bytes, "photo", ""))).resolves.toBe(
      true,
    );
  });

  it("does not recognise text, whatever the file claims to be", async () => {
    const disguised = file(ascii("hello, world"), "x.webp", "image/webp");

    await expect(hasPhotoSignature(disguised)).resolves.toBe(false);
  });
});

describe("preparePhoto", () => {
  it("refuses a text file renamed x.webp as an unsupported format", async () => {
    const disguised = file(ascii("hello, world"), "x.webp", "image/webp");

    await expect(preparePhoto(disguised, ORIGIN)).rejects.toMatchObject({
      name: PhotoPreparationError.name,
      rejection: "UNSUPPORTED_FORMAT",
    });
  });

  it("refuses HEIC by name before reading the bytes", async () => {
    const heic = file(JPEG_HEAD, "IMG_0042.HEIC", "");

    await expect(preparePhoto(heic, ORIGIN)).rejects.toMatchObject({
      rejection: "HEIC_NOT_SUPPORTED",
    });
  });
});
