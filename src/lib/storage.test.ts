import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { getPhotoStorage, type TransactionClient } from "./storage";

/**
 * The seam is exercised against a stubbed database client: what is worth
 * asserting here is the mapping — which columns a variant reads, that a
 * withdrawn asset's photo is filtered out *by the query*, and that a write
 * goes through the caller's transaction rather than through `db` — none of
 * which a live database would show more clearly. The real round trip of bytes
 * through PostgreSQL is the runtime walk's and the smoke path's to prove.
 */

vi.mock("@/lib/db", () => ({
  db: { assetPhotoContent: { findFirst: vi.fn(), create: vi.fn() } },
}));

const mockedFindFirst = vi.mocked(db.assetPhotoContent.findFirst);
const mockedDbCreate = vi.mocked(db.assetPhotoContent.create);

const PHOTO_ID = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const FULL_BYTES = Uint8Array.of(0xff, 0xd8, 0xff, 1, 2, 3);
const THUMB_BYTES = Uint8Array.of(0xff, 0xd8, 0xff, 4);

const LIVE_ASSET_FILTER = {
  photoId: PHOTO_ID,
  photo: { asset: { deletedAt: null } },
};

function transactionClient() {
  const create = vi.fn(async () => ({ photoId: PHOTO_ID }));
  const tx = { assetPhotoContent: { create } } as unknown as TransactionClient;
  return { tx, create };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("writePhotoContent", () => {
  it("writes both derivatives and their types through the caller's transaction", async () => {
    const { tx, create } = transactionClient();

    await getPhotoStorage().writePhotoContent(tx, PHOTO_ID, {
      fullBytes: FULL_BYTES,
      fullContentType: "image/jpeg",
      thumbBytes: THUMB_BYTES,
      thumbContentType: "image/webp",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          photoId: PHOTO_ID,
          fullBytes: FULL_BYTES,
          fullContentType: "image/jpeg",
          thumbBytes: THUMB_BYTES,
          thumbContentType: "image/webp",
        },
      }),
    );
    expect(mockedDbCreate).not.toHaveBeenCalled();
  });
});

describe("readPhotoVariant", () => {
  it("reads the full image and only the full image's columns", async () => {
    mockedFindFirst.mockResolvedValue({
      fullBytes: FULL_BYTES,
      fullContentType: "image/jpeg",
    } as never);

    const stored = await getPhotoStorage().readPhotoVariant(PHOTO_ID, "full");

    expect(stored).toEqual({ bytes: FULL_BYTES, contentType: "image/jpeg" });
    expect(mockedFindFirst).toHaveBeenCalledWith({
      where: LIVE_ASSET_FILTER,
      select: { fullBytes: true, fullContentType: true },
    });
  });

  it("reads the thumbnail without naming the full image's column", async () => {
    mockedFindFirst.mockResolvedValue({
      thumbBytes: THUMB_BYTES,
      thumbContentType: "image/webp",
    } as never);

    const stored = await getPhotoStorage().readPhotoVariant(PHOTO_ID, "thumb");

    expect(stored).toEqual({ bytes: THUMB_BYTES, contentType: "image/webp" });
    expect(mockedFindFirst).toHaveBeenCalledWith({
      where: LIVE_ASSET_FILTER,
      select: { thumbBytes: true, thumbContentType: true },
    });
  });

  it.each(["full", "thumb"] as const)(
    "answers null for the %s variant of an unknown photo or a withdrawn asset's, which the query cannot tell apart",
    async (variant) => {
      mockedFindFirst.mockResolvedValue(null);

      await expect(
        getPhotoStorage().readPhotoVariant(PHOTO_ID, variant),
      ).resolves.toBeNull();
    },
  );
});
