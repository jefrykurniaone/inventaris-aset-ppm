import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPhotoStorage, type TransactionClient } from "@/lib/storage";
import {
  createInMemoryPhotoStorage,
  type InMemoryPhotoStorage,
} from "@/lib/storage-fake";

import { GET } from "./route";

/**
 * `GET /api/photos/<photoId>/<variant>`, called with real `Request` objects
 * and the in-memory photo storage. The withdrawn-asset rule lives in the
 * storage read, so the fake's `withdraw` is what stands in for setting
 * `deletedAt` on the asset.
 */

vi.mock("@/lib/storage", () => ({ getPhotoStorage: vi.fn() }));

const PHOTO_ID = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const UNKNOWN_PHOTO_ID = "0199ffff-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const TX = {} as TransactionClient;

const FULL_BYTES = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3);
const THUMB_BYTES = Uint8Array.of(0x52, 0x49, 0x46, 0x46, 9);

const SERVING_HEADERS = {
  "cache-control": "public, max-age=31536000, immutable",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; sandbox",
};

let storage: InMemoryPhotoStorage;

function fetchPhoto(photoId: string, variant: string): Promise<Response> {
  const request = new Request(
    `http://localhost:3000/api/photos/${photoId}/${variant}`,
  );
  return GET(request, { params: Promise.resolve({ photoId, variant }) });
}

beforeEach(async () => {
  storage = createInMemoryPhotoStorage();
  vi.mocked(getPhotoStorage).mockReturnValue(storage);
  await storage.writePhotoContent(TX, PHOTO_ID, {
    fullBytes: FULL_BYTES,
    fullContentType: "image/jpeg",
    thumbBytes: THUMB_BYTES,
    thumbContentType: "image/webp",
  });
});

describe("serving a live photo", () => {
  it.each([
    ["full", FULL_BYTES, "image/jpeg"],
    ["thumb", THUMB_BYTES, "image/webp"],
  ] as const)(
    "answers 200 with the %s variant's bytes and all five headers",
    async (variant, bytes, contentType) => {
      const response = await fetchPhoto(PHOTO_ID, variant);

      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
      expect(Object.fromEntries(response.headers)).toEqual(
        expect.objectContaining({
          ...SERVING_HEADERS,
          "content-type": contentType,
          "content-length": String(bytes.length),
        }),
      );
    },
  );
});

describe("refusing to serve", () => {
  it("answers 404 for an unknown photo", async () => {
    const response = await fetchPhoto(UNKNOWN_PHOTO_ID, "full");

    expect(response.status).toBe(404);
  });

  it("answers 404 for both variants of a withdrawn asset's photo", async () => {
    storage.withdraw(PHOTO_ID);

    const statuses = await Promise.all(
      ["full", "thumb"].map(async (variant) => {
        const response = await fetchPhoto(PHOTO_ID, variant);
        return response.status;
      }),
    );

    expect(statuses).toEqual([404, 404]);
  });

  it("answers 404 for a deleted photo on the very next request", async () => {
    storage.removePhoto(PHOTO_ID);

    const response = await fetchPhoto(PHOTO_ID, "thumb");

    expect(response.status).toBe(404);
  });

  it.each(["original", "thumbnail", "FULL", ""])(
    "answers 404 for the variant %j",
    async (variant) => {
      const response = await fetchPhoto(PHOTO_ID, variant);

      expect(response.status).toBe(404);
    },
  );

  it("answers 404 for an id that is not a photo id, without a lookup", async () => {
    const read = vi.spyOn(storage, "readPhotoVariant");

    const response = await fetchPhoto("../../etc/passwd", "full");

    expect(response.status).toBe(404);
    expect(read).not.toHaveBeenCalled();
  });

  it("never lets a refusal be cached", async () => {
    const response = await fetchPhoto(UNKNOWN_PHOTO_ID, "thumb");

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("answers a storage failure with an empty 500 and logs it", async () => {
    vi.spyOn(storage, "readPhotoVariant").mockRejectedValue(
      new Error("connection reset"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await fetchPhoto(PHOTO_ID, "full");

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("");
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("connection reset"),
    );
    consoleError.mockRestore();
  });
});
