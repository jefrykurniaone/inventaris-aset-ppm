import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PHOTOS_PER_ASSET } from "@/lib/photo-upload";
import { requireUser } from "@/lib/require-user";
import { getObjectStorage } from "@/lib/storage";
import {
  createInMemoryObjectStorage,
  type InMemoryObjectStorage,
} from "@/lib/storage-fake";

import {
  deletePhotoAction,
  reorderPhotosAction,
  setPrimaryPhotoAction,
} from "./actions";
import { removePhoto, reorderPhotos, setPrimaryPhoto } from "./mutations";

/**
 * The three single round-trip photo actions. Split from `actions.test.ts`,
 * which holds the upload path and the authorisation boundary for all five,
 * only so that both files stay inside the project's 300-line limit.
 *
 * The one behaviour worth spelling out here is the ordering around deletion:
 * the objects go only after the row is gone, and a row that was not there
 * leaves the bucket untouched.
 */

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("@/lib/require-user", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/storage", () => ({ getObjectStorage: vi.fn() }));
vi.mock("./mutations", () => ({
  countLivePhotos: vi.fn(),
  insertPhoto: vi.fn(),
  removePhoto: vi.fn(),
  reorderPhotos: vi.fn(),
  setPrimaryPhoto: vi.fn(),
}));

const mockedRequireUser = vi.mocked(requireUser);
const mockedGetObjectStorage = vi.mocked(getObjectStorage);
const mockedRemovePhoto = vi.mocked(removePhoto);
const mockedReorderPhotos = vi.mocked(reorderPhotos);
const mockedSetPrimaryPhoto = vi.mocked(setPrimaryPhoto);

const ACTOR_ID = "user-1";
const ASSET_ID = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const PHOTO_ID = "photo-1";
const FULL_PATH = `assets/${ASSET_ID}/aaaaaaaaaaaaaaaa.webp`;
const THUMB_PATH = `assets/${ASSET_ID}/bbbbbbbbbbbbbbbb.webp`;
const STORED = { contentType: "image/webp", sizeBytes: 400_000 };

let storage: InMemoryObjectStorage;

function photoRef() {
  return { assetId: ASSET_ID, photoId: PHOTO_ID };
}

beforeEach(() => {
  vi.clearAllMocks();
  storage = createInMemoryObjectStorage();
  storage.putObject(FULL_PATH, STORED);
  storage.putObject(THUMB_PATH, STORED);
  mockedGetObjectStorage.mockReturnValue(storage);
  mockedRequireUser.mockResolvedValue({ id: ACTOR_ID } as Awaited<
    ReturnType<typeof requireUser>
  >);
});

describe("deletePhotoAction", () => {
  it("removes the row first, then both objects", async () => {
    mockedRemovePhoto.mockResolvedValue({
      ok: true,
      value: { objectPaths: [FULL_PATH, THUMB_PATH] },
    });

    const result = await deletePhotoAction(photoRef());

    expect(result.ok).toBe(true);
    expect(mockedRemovePhoto).toHaveBeenCalledWith(
      ASSET_ID,
      PHOTO_ID,
      ACTOR_ID,
    );
    expect(storage.storedPaths()).toEqual([]);
  });

  it("leaves the objects alone when the row was not there to delete", async () => {
    mockedRemovePhoto.mockResolvedValue({ ok: false, reason: "NOT_FOUND" });

    const result = await deletePhotoAction(photoRef());

    expect(result).toEqual({ ok: false, message: "photoNotFound" });
    expect(storage.storedPaths()).toHaveLength(2);
  });
});

describe("setPrimaryPhotoAction", () => {
  it("promotes through the mutation that demotes in the same transaction", async () => {
    mockedSetPrimaryPhoto.mockResolvedValue({ ok: true, value: undefined });

    const result = await setPrimaryPhotoAction(photoRef());

    expect(result.ok).toBe(true);
    expect(mockedSetPrimaryPhoto).toHaveBeenCalledWith(ASSET_ID, PHOTO_ID);
  });

  it("refuses a photo id that belongs to a different asset", async () => {
    mockedSetPrimaryPhoto.mockResolvedValue({ ok: false, reason: "NOT_FOUND" });

    const result = await setPrimaryPhotoAction(photoRef());

    expect(result).toEqual({ ok: false, message: "photoNotFound" });
  });
});

describe("reorderPhotosAction", () => {
  it("passes the submitted order through", async () => {
    mockedReorderPhotos.mockResolvedValue({ ok: true, value: undefined });

    const result = await reorderPhotosAction({
      assetId: ASSET_ID,
      photoIds: ["b", "a"],
    });

    expect(result.ok).toBe(true);
    expect(mockedReorderPhotos).toHaveBeenCalledWith(ASSET_ID, ["b", "a"]);
  });

  it("refuses a list longer than the per-asset maximum", async () => {
    const tooMany = Array.from(
      { length: MAX_PHOTOS_PER_ASSET + 1 },
      (_, index) => `photo-${index}`,
    );

    const result = await reorderPhotosAction({
      assetId: ASSET_ID,
      photoIds: tooMany,
    });

    expect(result).toEqual({ ok: false, message: "invalidRequest" });
    expect(mockedReorderPhotos).not.toHaveBeenCalled();
  });
});
