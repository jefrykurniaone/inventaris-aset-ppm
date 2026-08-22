import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildCompressionOptions,
  COMPRESSION_WORKER_PATH,
  FULL_IMAGE_MAX_EDGE_PX,
  FULL_IMAGE_MAX_SIZE_MB,
  PHOTO_INITIAL_QUALITY,
  PHOTO_OUTPUT_CONTENT_TYPE,
  THUMBNAIL_MAX_EDGE_PX,
} from "./photo-compression";

const ORIGIN = "https://inventaris.example.test";

function resolveFromRepositoryRoot(relativePath: string): string {
  return fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));
}

describe("buildCompressionOptions", () => {
  it("resizes the full image to 1600 px and about 400 KB (FR-4.3)", () => {
    const options = buildCompressionOptions("full", ORIGIN);

    expect(options.maxWidthOrHeight).toBe(FULL_IMAGE_MAX_EDGE_PX);
    expect(options.maxSizeMB).toBe(FULL_IMAGE_MAX_SIZE_MB);
  });

  it("resizes the thumbnail to 400 px, smaller than the full image", () => {
    const thumbnail = buildCompressionOptions("thumbnail", ORIGIN);
    const full = buildCompressionOptions("full", ORIGIN);

    expect(thumbnail.maxWidthOrHeight).toBe(THUMBNAIL_MAX_EDGE_PX);
    expect(thumbnail.maxSizeMB).toBeLessThan(full.maxSizeMB);
  });

  it.each(["full", "thumbnail"] as const)(
    "re-encodes the %s derivative as WebP at the shared initial quality",
    (derivative) => {
      const options = buildCompressionOptions(derivative, ORIGIN);

      expect(options.fileType).toBe(PHOTO_OUTPUT_CONTENT_TYPE);
      expect(options.initialQuality).toBe(PHOTO_INITIAL_QUALITY);
      expect(options.useWebWorker).toBe(true);
    },
  );

  it("points libURL at this application's own origin, never at a CDN", () => {
    const { libURL } = buildCompressionOptions("full", ORIGIN);

    expect(libURL).toBe(`${ORIGIN}${COMPRESSION_WORKER_PATH}`);
    expect(libURL).not.toContain("cdn.jsdelivr.net");
    expect(new URL(libURL).origin).toBe(ORIGIN);
  });

  it("makes libURL absolute, because the worker resolves it from a blob URL", () => {
    const { libURL } = buildCompressionOptions("thumbnail", ORIGIN);

    expect(libURL.startsWith("https://")).toBe(true);
  });

  it("passes the caller's progress callback and abort signal straight through", () => {
    const controller = new AbortController();
    const onProgress = (): void => undefined;

    const options = buildCompressionOptions("full", ORIGIN, {
      signal: controller.signal,
      onProgress,
    });

    expect(options.signal).toBe(controller.signal);
    expect(options.onProgress).toBe(onProgress);
  });

  it("omits the hooks when none are given, rather than passing undefined ones", () => {
    const options = buildCompressionOptions("full", ORIGIN);

    expect(options.signal).toBeUndefined();
    expect(options.onProgress).toBeUndefined();
  });
});

describe("the self-hosted compression worker", () => {
  it("is byte-identical to the installed browser-image-compression build", () => {
    const vendored = readFileSync(
      resolveFromRepositoryRoot(`public${COMPRESSION_WORKER_PATH}`),
    );
    const installed = readFileSync(
      resolveFromRepositoryRoot(
        "node_modules/browser-image-compression/dist/browser-image-compression.js",
      ),
    );

    expect(vendored.equals(installed)).toBe(true);
  });

  it("is served from this application's own origin", () => {
    expect(COMPRESSION_WORKER_PATH.startsWith("/")).toBe(true);
    expect(COMPRESSION_WORKER_PATH).not.toContain("//");
  });
});
