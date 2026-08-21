import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/require-user";

import {
  createBuildingAction,
  deactivateBuildingAction,
  deleteBuildingAction,
  reactivateBuildingAction,
  updateBuildingAction,
} from "./actions";
import {
  createBuilding,
  deleteBuilding,
  setBuildingActive,
  updateBuilding,
} from "./mutations";
import { INITIAL_BUILDING_FORM_STATE } from "./schemas";

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
  requireAdmin: vi.fn(),
}));

vi.mock("./mutations", () => ({
  createBuilding: vi.fn(),
  updateBuilding: vi.fn(),
  deleteBuilding: vi.fn(),
  setBuildingActive: vi.fn(),
}));

const mockedCreateBuilding = vi.mocked(createBuilding);
const mockedUpdateBuilding = vi.mocked(updateBuilding);
const mockedDeleteBuilding = vi.mocked(deleteBuilding);
const mockedSetBuildingActive = vi.mocked(setBuildingActive);
const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRedirect = vi.mocked(redirect);

function buildingFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields = { code: "GD1", name: "Gedung 1", ...overrides };
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue(
    {} as Awaited<ReturnType<typeof requireAdmin>>,
  );
});

describe("createBuildingAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller, and never creates a building", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      createBuildingAction(INITIAL_BUILDING_FORM_STATE, buildingFormData()),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedCreateBuilding).not.toHaveBeenCalled();
  });

  it("returns a field error for a blank code without calling createBuilding", async () => {
    const result = await createBuildingAction(
      INITIAL_BUILDING_FORM_STATE,
      buildingFormData({ code: "  " }),
    );

    expect(result.fieldErrors.code).toBe("codeRequired");
    expect(mockedCreateBuilding).not.toHaveBeenCalled();
  });

  it("creates the building and revalidates the list on success", async () => {
    mockedCreateBuilding.mockResolvedValue({ ok: true });

    const result = await createBuildingAction(
      INITIAL_BUILDING_FORM_STATE,
      buildingFormData(),
    );

    expect(result.isSuccess).toBe(true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/buildings");
  });

  it("maps a duplicate code to a localised, non-generic message", async () => {
    mockedCreateBuilding.mockResolvedValue({
      ok: false,
      reason: "DUPLICATE_CODE",
    });

    const result = await createBuildingAction(
      INITIAL_BUILDING_FORM_STATE,
      buildingFormData(),
    );

    expect(result.formError).toBe("codeAlreadyUsed");
  });
});

describe("updateBuildingAction", () => {
  function updateFormData(overrides: Record<string, string> = {}): FormData {
    return buildingFormData({ id: "building-1", ...overrides });
  }

  it("is refused server-side when requireAdmin rejects a non-admin caller, and never updates a building", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      updateBuildingAction(INITIAL_BUILDING_FORM_STATE, updateFormData()),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedUpdateBuilding).not.toHaveBeenCalled();
  });

  it("redirects to the list on success", async () => {
    mockedUpdateBuilding.mockResolvedValue({ ok: true });

    await expect(
      updateBuildingAction(INITIAL_BUILDING_FORM_STATE, updateFormData()),
    ).rejects.toThrow("REDIRECT");

    expect(mockedRedirect).toHaveBeenCalledWith("/admin/buildings");
  });
});

function idFormData(id: string): FormData {
  const formData = new FormData();
  formData.set("id", id);
  return formData;
}

describe("deleteBuildingAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller, and never deletes a building", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      deleteBuildingAction({ formError: null }, idFormData("building-1")),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedDeleteBuilding).not.toHaveBeenCalled();
  });

  it("maps a still-referenced building — including the race where a room appears between render and click — to a localised message", async () => {
    mockedDeleteBuilding.mockResolvedValue({ ok: false, reason: "REFERENCED" });

    const result = await deleteBuildingAction(
      { formError: null },
      idFormData("building-1"),
    );

    expect(result.formError).toBe("stillReferenced");
  });

  it("deletes and revalidates on success", async () => {
    mockedDeleteBuilding.mockResolvedValue({ ok: true });

    const result = await deleteBuildingAction(
      { formError: null },
      idFormData("building-1"),
    );

    expect(result.formError).toBeNull();
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/buildings");
  });
});

describe("deactivateBuildingAction / reactivateBuildingAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      deactivateBuildingAction(idFormData("building-1")),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedSetBuildingActive).not.toHaveBeenCalled();
  });

  it("deactivates and revalidates", async () => {
    mockedSetBuildingActive.mockResolvedValue({ ok: true });

    await deactivateBuildingAction(idFormData("building-1"));

    expect(mockedSetBuildingActive).toHaveBeenCalledWith("building-1", false);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/buildings");
  });

  it("reactivates and revalidates", async () => {
    mockedSetBuildingActive.mockResolvedValue({ ok: true });

    await reactivateBuildingAction(idFormData("building-1"));

    expect(mockedSetBuildingActive).toHaveBeenCalledWith("building-1", true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/buildings");
  });
});
