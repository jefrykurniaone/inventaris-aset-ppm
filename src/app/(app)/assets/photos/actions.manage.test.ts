import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PHOTOS_PER_ASSET } from "@/lib/photo-upload";
import { requireUser } from "@/lib/require-user";

import { reorderPhotosAction, setPrimaryPhotoAction } from "./actions";
import { reorderPhotos, setPrimaryPhoto } from "./mutations";

/**
 * Set-primary and reorder. Split from `actions.test.ts`, which holds the
 * authorisation boundary for all three management actions and the delete,
 * so that each file stays short and reads as one concern.
 */

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("@/lib/require-user", () => ({ requireUser: vi.fn() }));
vi.mock("./mutations", () => ({
  removePhoto: vi.fn(),
  reorderPhotos: vi.fn(),
  setPrimaryPhoto: vi.fn(),
}));

const mockedRequireUser = vi.mocked(requireUser);
const mockedReorderPhotos = vi.mocked(reorderPhotos);
const mockedSetPrimaryPhoto = vi.mocked(setPrimaryPhoto);

const ACTOR_ID = "user-1";
const ASSET_ID = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const PHOTO_ID = "photo-1";

function photoRef() {
  return { assetId: ASSET_ID, photoId: PHOTO_ID };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireUser.mockResolvedValue({ id: ACTOR_ID } as Awaited<
    ReturnType<typeof requireUser>
  >);
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
