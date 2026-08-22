import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireUser } from "@/lib/require-user";

import {
  createAssetAction,
  deleteAssetAction,
  updateAssetAction,
} from "./actions";
import { createAsset, softDeleteAsset, updateAsset } from "./mutations";
import { INITIAL_ASSET_FORM_STATE } from "./schemas";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/require-user", () => ({
  requireUser: vi.fn(),
}));

vi.mock("./mutations", () => ({
  createAsset: vi.fn(),
  updateAsset: vi.fn(),
  softDeleteAsset: vi.fn(),
}));

const mockedCreateAsset = vi.mocked(createAsset);
const mockedUpdateAsset = vi.mocked(updateAsset);
const mockedSoftDeleteAsset = vi.mocked(softDeleteAsset);
const mockedRequireUser = vi.mocked(requireUser);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRedirect = vi.mocked(redirect);

const ACTOR_ID = "user-1";
const ASSET_ID = "asset-1";
const CURRENT_YEAR = new Date().getFullYear();

function assetFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields = {
    name: "Mikroskop Binokuler",
    categoryId: "category-1",
    roomId: "room-1",
    condition: "good",
    status: "active",
    acquisitionYear: String(CURRENT_YEAR),
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function idFormData(id: string): FormData {
  const formData = new FormData();
  formData.set("id", id);
  return formData;
}

function rejectAuthorisation(): void {
  mockedRequireUser.mockRejectedValue(new Error("REDIRECT:/sign-in"));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireUser.mockResolvedValue({ id: ACTOR_ID } as Awaited<
    ReturnType<typeof requireUser>
  >);
});

describe("createAssetAction", () => {
  it("is refused server-side when requireUser rejects, and never creates an asset", async () => {
    rejectAuthorisation();

    await expect(
      createAssetAction(INITIAL_ASSET_FORM_STATE, assetFormData()),
    ).rejects.toThrow("REDIRECT:/sign-in");

    expect(mockedCreateAsset).not.toHaveBeenCalled();
  });

  it("rejects a payload that bypassed the client, without touching the database", async () => {
    const result = await createAssetAction(
      INITIAL_ASSET_FORM_STATE,
      assetFormData({ condition: "pristine", acquisitionYear: "1200" }),
    );

    expect(result.fieldErrors.condition).toBe("conditionRequired");
    expect(result.fieldErrors.acquisitionYear).toBe("acquisitionYearInvalid");
    expect(mockedCreateAsset).not.toHaveBeenCalled();
  });

  it("never lets the client choose an asset code or a QR token", async () => {
    mockedCreateAsset.mockResolvedValue({
      ok: true,
      assetId: ASSET_ID,
      assetCode: "PPM-LAB-2026-0001",
    });

    await expect(
      createAssetAction(
        INITIAL_ASSET_FORM_STATE,
        assetFormData({
          assetCode: "PPM-LAB-1999-0001",
          qrToken: "attackerchose",
        }),
      ),
    ).rejects.toThrow("REDIRECT");

    const [submitted] = mockedCreateAsset.mock.calls[0];
    expect(submitted).not.toHaveProperty("assetCode");
    expect(submitted).not.toHaveProperty("qrToken");
  });

  it("creates the asset for the signed-in user and redirects to the list", async () => {
    mockedCreateAsset.mockResolvedValue({
      ok: true,
      assetId: ASSET_ID,
      assetCode: "PPM-LAB-2026-0001",
    });

    await expect(
      createAssetAction(INITIAL_ASSET_FORM_STATE, assetFormData()),
    ).rejects.toThrow("REDIRECT");

    expect(mockedCreateAsset).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Mikroskop Binokuler" }),
      ACTOR_ID,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/assets");
    expect(mockedRedirect).toHaveBeenCalledWith("/assets");
  });

  it("reads an empty optional field as absent rather than as an empty string", async () => {
    mockedCreateAsset.mockResolvedValue({
      ok: true,
      assetId: ASSET_ID,
      assetCode: "PPM-LAB-2026-0001",
    });

    await expect(
      createAssetAction(
        INITIAL_ASSET_FORM_STATE,
        assetFormData({ brand: "", purchasePrice: "", warrantyUntil: "" }),
      ),
    ).rejects.toThrow("REDIRECT");

    const [submitted] = mockedCreateAsset.mock.calls[0];
    expect(submitted.brand).toBeNull();
    expect(submitted.purchasePrice).toBeNull();
    expect(submitted.warrantyUntil).toBeNull();
  });

  it.each([
    ["SEQUENCE_EXHAUSTED", "sequenceExhausted"],
    ["INVALID_REFERENCE", "invalidReference"],
    ["CODE_COLLISION", "unexpectedError"],
  ] as const)(
    "maps %s to a localised, non-generic form error",
    async (reason, messageKey) => {
      mockedCreateAsset.mockResolvedValue({ ok: false, reason });

      const result = await createAssetAction(
        INITIAL_ASSET_FORM_STATE,
        assetFormData(),
      );

      expect(result.formError).toBe(messageKey);
      expect(mockedRedirect).not.toHaveBeenCalled();
    },
  );
});

describe("updateAssetAction", () => {
  function updateFormData(overrides: Record<string, string> = {}): FormData {
    return assetFormData({ id: ASSET_ID, ...overrides });
  }

  it("is refused server-side when requireUser rejects, and never updates an asset", async () => {
    rejectAuthorisation();

    await expect(
      updateAssetAction(INITIAL_ASSET_FORM_STATE, updateFormData()),
    ).rejects.toThrow("REDIRECT:/sign-in");

    expect(mockedUpdateAsset).not.toHaveBeenCalled();
  });

  it("refuses to edit an asset that is out on loan, with a localised explanation", async () => {
    mockedUpdateAsset.mockResolvedValue({
      ok: false,
      reason: "STATUS_LOCKED_BY_LOAN",
    });

    const result = await updateAssetAction(
      INITIAL_ASSET_FORM_STATE,
      updateFormData({ status: "retired" }),
    );

    expect(result.formError).toBe("statusLockedByLoan");
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("reports a missing asset rather than raising", async () => {
    mockedUpdateAsset.mockResolvedValue({ ok: false, reason: "NOT_FOUND" });

    const result = await updateAssetAction(
      INITIAL_ASSET_FORM_STATE,
      updateFormData(),
    );

    expect(result.formError).toBe("notFound");
  });

  it("updates and redirects on success", async () => {
    mockedUpdateAsset.mockResolvedValue({ ok: true });

    await expect(
      updateAssetAction(INITIAL_ASSET_FORM_STATE, updateFormData()),
    ).rejects.toThrow("REDIRECT");

    expect(mockedUpdateAsset).toHaveBeenCalledWith(
      ASSET_ID,
      expect.objectContaining({ status: "active" }),
      ACTOR_ID,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/assets");
  });
});

describe("deleteAssetAction", () => {
  it("is refused server-side when requireUser rejects, and never deletes an asset", async () => {
    rejectAuthorisation();

    await expect(
      deleteAssetAction({ formError: null }, idFormData(ASSET_ID)),
    ).rejects.toThrow("REDIRECT:/sign-in");

    expect(mockedSoftDeleteAsset).not.toHaveBeenCalled();
  });

  it("soft-deletes as the signed-in user and revalidates the list", async () => {
    mockedSoftDeleteAsset.mockResolvedValue({ ok: true });

    const result = await deleteAssetAction(
      { formError: null },
      idFormData(ASSET_ID),
    );

    expect(result.formError).toBeNull();
    expect(mockedSoftDeleteAsset).toHaveBeenCalledWith(ASSET_ID, ACTOR_ID);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/assets");
  });

  it("maps an already-deleted asset to a localised message", async () => {
    mockedSoftDeleteAsset.mockResolvedValue({ ok: false, reason: "NOT_FOUND" });

    const result = await deleteAssetAction(
      { formError: null },
      idFormData(ASSET_ID),
    );

    expect(result.formError).toBe("notFound");
  });
});
