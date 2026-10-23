import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireUser } from "@/lib/require-user";

import {
  deletePhotoAction,
  reorderPhotosAction,
  setPrimaryPhotoAction,
} from "./actions";
import { removePhoto, reorderPhotos, setPrimaryPhoto } from "./mutations";

/**
 * The authorisation boundary for the three photo management actions, and
 * the delete. Set-primary and reorder are in `actions.manage.test.ts`.
 *
 * Adding a photo is not an action any more (ADR 0009); its boundary is
 * tested against the route handler in
 * `src/app/api/assets/[id]/photos/route.test.ts`.
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
const mockedRemovePhoto = vi.mocked(removePhoto);
const mockedReorderPhotos = vi.mocked(reorderPhotos);
const mockedSetPrimaryPhoto = vi.mocked(setPrimaryPhoto);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const ACTOR_ID = "user-1";
const ASSET_ID = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const PHOTO_ID = "photo-1";

function photoRef() {
  return { assetId: ASSET_ID, photoId: PHOTO_ID };
}

/** Every entry point, so a new action cannot be added without either being
 * listed here or leaving an obvious hole. */
const GUARDED_ACTIONS = [
  ["deletePhotoAction", () => deletePhotoAction(photoRef())],
  ["setPrimaryPhotoAction", () => setPrimaryPhotoAction(photoRef())],
  [
    "reorderPhotosAction",
    () => reorderPhotosAction({ assetId: ASSET_ID, photoIds: [PHOTO_ID] }),
  ],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireUser.mockResolvedValue({ id: ACTOR_ID } as Awaited<
    ReturnType<typeof requireUser>
  >);
});

describe("the authorisation boundary", () => {
  it.each(GUARDED_ACTIONS)(
    "%s reaches no mutation without a session",
    async (_name, invoke) => {
      mockedRequireUser.mockRejectedValue(new Error("REDIRECT:/sign-in"));

      await expect(invoke()).rejects.toThrow("REDIRECT:/sign-in");

      expect(mockedRemovePhoto).not.toHaveBeenCalled();
      expect(mockedSetPrimaryPhoto).not.toHaveBeenCalled();
      expect(mockedReorderPhotos).not.toHaveBeenCalled();
    },
  );
});

describe("deletePhotoAction", () => {
  it("removes the photo as the signed-in user, scoped to the asset", async () => {
    mockedRemovePhoto.mockResolvedValue({ ok: true, value: undefined });

    const result = await deletePhotoAction(photoRef());

    expect(result.ok).toBe(true);
    expect(mockedRemovePhoto).toHaveBeenCalledWith(
      ASSET_ID,
      PHOTO_ID,
      ACTOR_ID,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/assets");
  });

  it("refuses a photo that is not this asset's", async () => {
    mockedRemovePhoto.mockResolvedValue({ ok: false, reason: "NOT_FOUND" });

    const result = await deletePhotoAction(photoRef());

    expect(result).toEqual({ ok: false, message: "photoNotFound" });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a malformed request without reaching the database", async () => {
    const result = await deletePhotoAction({ assetId: ASSET_ID });

    expect(result).toEqual({ ok: false, message: "invalidRequest" });
    expect(mockedRemovePhoto).not.toHaveBeenCalled();
  });
});
