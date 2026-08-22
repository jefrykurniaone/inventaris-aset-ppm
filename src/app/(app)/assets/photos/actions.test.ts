import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PHOTOS_PER_ASSET } from "@/lib/photo-upload";
import { requireUser } from "@/lib/require-user";
import { getObjectStorage } from "@/lib/storage";
import {
  createInMemoryObjectStorage,
  type InMemoryObjectStorage,
} from "@/lib/storage-fake";

import {
  attachPhotoAction,
  deletePhotoAction,
  reorderPhotosAction,
  requestPhotoUploadAction,
  setPrimaryPhotoAction,
} from "./actions";
import { countLivePhotos, insertPhoto } from "./mutations";

/**
 * The upload half of the photo actions, plus the authorisation boundary for
 * all five. The three single round-trip actions are in
 * `actions.manage.test.ts`, split off only to keep both files inside the
 * project's 300-line limit.
 *
 * What is worth asserting here is the boundary, not the SQL: that a caller
 * with no session reaches nothing, that the size and type checks read the
 * bucket rather than the request, and that an object never outlives the row it
 * was uploaded for. The database layer is mocked; object storage is the
 * in-memory fake, which is what the seam's interface exists for.
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
const mockedCountLivePhotos = vi.mocked(countLivePhotos);
const mockedInsertPhoto = vi.mocked(insertPhoto);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const ACTOR_ID = "user-1";
const ASSET_ID = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const PHOTO_ID = "photo-1";
const FULL_PATH = `assets/${ASSET_ID}/aaaaaaaaaaaaaaaa.webp`;
const THUMB_PATH = `assets/${ASSET_ID}/bbbbbbbbbbbbbbbb.webp`;
const WEBP = "image/webp";
const SMALL = 400_000;
const HUGE = 4_000_000;

let storage: InMemoryObjectStorage;

function uploadRequest(overrides: Record<string, unknown> = {}) {
  return {
    assetId: ASSET_ID,
    contentType: WEBP,
    sizeBytes: SMALL,
    thumbnailContentType: WEBP,
    thumbnailSizeBytes: 20_000,
    ...overrides,
  };
}

function attachRequest(overrides: Record<string, unknown> = {}) {
  return {
    assetId: ASSET_ID,
    objectPath: FULL_PATH,
    thumbnailObjectPath: THUMB_PATH,
    width: 1600,
    height: 1200,
    ...overrides,
  };
}

function storeBoth(sizeBytes = SMALL, contentType = WEBP): void {
  storage.putObject(FULL_PATH, { contentType, sizeBytes });
  storage.putObject(THUMB_PATH, { contentType, sizeBytes: 20_000 });
}

/** Every entry point, so a new action cannot be added without either being
 * listed here or leaving an obvious hole. */
const GUARDED_ACTIONS = [
  ["requestPhotoUploadAction", () => requestPhotoUploadAction(uploadRequest())],
  ["attachPhotoAction", () => attachPhotoAction(attachRequest())],
  [
    "deletePhotoAction",
    () => deletePhotoAction({ assetId: ASSET_ID, photoId: PHOTO_ID }),
  ],
  [
    "setPrimaryPhotoAction",
    () => setPrimaryPhotoAction({ assetId: ASSET_ID, photoId: PHOTO_ID }),
  ],
  [
    "reorderPhotosAction",
    () => reorderPhotosAction({ assetId: ASSET_ID, photoIds: [PHOTO_ID] }),
  ],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  storage = createInMemoryObjectStorage();
  mockedGetObjectStorage.mockReturnValue(storage);
  mockedRequireUser.mockResolvedValue({ id: ACTOR_ID } as Awaited<
    ReturnType<typeof requireUser>
  >);
  mockedCountLivePhotos.mockResolvedValue(0);
});

describe("the authorisation boundary", () => {
  it.each(GUARDED_ACTIONS)(
    "%s reaches neither storage nor the database without a session",
    async (_name, invoke) => {
      mockedRequireUser.mockRejectedValue(new Error("REDIRECT:/sign-in"));

      await expect(invoke()).rejects.toThrow("REDIRECT:/sign-in");

      expect(storage.signedPaths).toEqual([]);
      expect(mockedCountLivePhotos).not.toHaveBeenCalled();
      expect(mockedInsertPhoto).not.toHaveBeenCalled();
    },
  );
});

describe("requestPhotoUploadAction", () => {
  it("mints one target per derivative, both under assets/<assetId>/", async () => {
    const result = await requestPhotoUploadAction(uploadRequest());

    expect(result.ok).toBe(true);
    expect(storage.signedPaths).toHaveLength(2);
    for (const objectPath of storage.signedPaths) {
      expect(objectPath.startsWith(`assets/${ASSET_ID}/`)).toBe(true);
      expect(objectPath.endsWith(".webp")).toBe(true);
    }
  });

  it("never lets the client choose the object path", async () => {
    await requestPhotoUploadAction(
      uploadRequest({ objectPath: "assets/other/evil.webp" }),
    );

    expect(storage.signedPaths).not.toContain("assets/other/evil.webp");
  });

  it.each(["image/heic", "image/gif", "application/pdf"])(
    "refuses the declared type %s with a message that names the format",
    async (contentType) => {
      const result = await requestPhotoUploadAction(
        uploadRequest({ contentType }),
      );

      expect(result).toEqual({ ok: false, message: "unsupportedFormat" });
      expect(storage.signedPaths).toEqual([]);
    },
  );

  it("refuses a declared size over the cap, naming the size not the request", async () => {
    const result = await requestPhotoUploadAction(
      uploadRequest({ sizeBytes: HUGE }),
    );

    expect(result).toEqual({ ok: false, message: "tooLarge" });
    expect(storage.signedPaths).toEqual([]);
  });

  it("refuses a malformed request as malformed, not as a bad photo", async () => {
    const result = await requestPhotoUploadAction({ assetId: ASSET_ID });

    expect(result).toEqual({ ok: false, message: "invalidRequest" });
    expect(storage.signedPaths).toEqual([]);
  });

  it.each([
    [null, "assetNotFound"],
    [MAX_PHOTOS_PER_ASSET, "limitReached"],
  ] as const)(
    "refuses a live photo count of %s before anything is uploaded",
    async (photoCount, message) => {
      mockedCountLivePhotos.mockResolvedValue(photoCount);

      const result = await requestPhotoUploadAction(uploadRequest());

      expect(result).toEqual({ ok: false, message });
      expect(storage.signedPaths).toEqual([]);
    },
  );
});

describe("attachPhotoAction", () => {
  it("stores the object path, never a URL, and the size the bucket reports", async () => {
    storeBoth();
    mockedInsertPhoto.mockResolvedValue({
      ok: true,
      value: { photoId: PHOTO_ID },
    });

    const result = await attachPhotoAction(attachRequest());

    expect(result.ok).toBe(true);
    expect(mockedInsertPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: ASSET_ID,
        actorId: ACTOR_ID,
        objectPath: FULL_PATH,
        thumbObjectPath: THUMB_PATH,
        sizeBytes: SMALL,
      }),
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/assets");
  });

  it.each([
    [HUGE, WEBP, "tooLarge"],
    [SMALL, "image/gif", "unsupportedFormat"],
  ] as const)(
    "rejects a stored object of %s bytes and type %s, whatever the client declared, and removes it",
    async (sizeBytes, contentType, message) => {
      storeBoth(sizeBytes, contentType);

      const result = await attachPhotoAction(attachRequest());

      expect(result).toEqual({ ok: false, message });
      expect(mockedInsertPhoto).not.toHaveBeenCalled();
      expect(storage.storedPaths()).toEqual([]);
    },
  );

  it("refuses a path belonging to another asset, without statting it", async () => {
    const foreignPath = "assets/someone-else/cccccccccccccccc.webp";
    storage.putObject(foreignPath, { contentType: WEBP, sizeBytes: SMALL });

    const result = await attachPhotoAction(
      attachRequest({ objectPath: foreignPath }),
    );

    expect(result).toEqual({ ok: false, message: "invalidRequest" });
    expect(storage.storedPaths()).toEqual([foreignPath]);
    expect(mockedInsertPhoto).not.toHaveBeenCalled();
  });

  it("refuses when the upload never landed", async () => {
    const result = await attachPhotoAction(attachRequest());

    expect(result).toEqual({ ok: false, message: "uploadIncomplete" });
    expect(mockedInsertPhoto).not.toHaveBeenCalled();
  });

  it("removes both objects when the row is refused, so nothing is orphaned", async () => {
    storeBoth();
    mockedInsertPhoto.mockResolvedValue({ ok: false, reason: "LIMIT_REACHED" });

    const result = await attachPhotoAction(attachRequest());

    expect(result).toEqual({ ok: false, message: "limitReached" });
    expect(storage.storedPaths()).toEqual([]);
  });

  it("reports a storage outage as a localised message, not as a raised error", async () => {
    mockedGetObjectStorage.mockReturnValue({
      ...storage,
      statObject: () => Promise.reject(new Error("connection refused")),
    });

    const result = await attachPhotoAction(attachRequest());

    expect(result).toEqual({ ok: false, message: "storageUnavailable" });
  });
});
