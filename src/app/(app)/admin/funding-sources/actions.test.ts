import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/require-user";

import {
  createFundingSourceAction,
  deactivateFundingSourceAction,
  deleteFundingSourceAction,
  reactivateFundingSourceAction,
  updateFundingSourceAction,
} from "./actions";
import {
  createFundingSource,
  deleteFundingSource,
  setFundingSourceActive,
  updateFundingSource,
} from "./mutations";
import { INITIAL_FUNDING_SOURCE_FORM_STATE } from "./schemas";

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
  createFundingSource: vi.fn(),
  updateFundingSource: vi.fn(),
  deleteFundingSource: vi.fn(),
  setFundingSourceActive: vi.fn(),
}));

const mockedCreateFundingSource = vi.mocked(createFundingSource);
const mockedUpdateFundingSource = vi.mocked(updateFundingSource);
const mockedDeleteFundingSource = vi.mocked(deleteFundingSource);
const mockedSetFundingSourceActive = vi.mocked(setFundingSourceActive);
const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRedirect = vi.mocked(redirect);

function fundingSourceFormData(
  overrides: Record<string, string> = {},
): FormData {
  const formData = new FormData();
  const fields = {
    name: "Hibah Penelitian",
    notes: "Dana penelitian tahun 2026",
    ...overrides,
  };
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

describe("createFundingSourceAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller, and never creates a funding source", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      createFundingSourceAction(
        INITIAL_FUNDING_SOURCE_FORM_STATE,
        fundingSourceFormData(),
      ),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedCreateFundingSource).not.toHaveBeenCalled();
  });

  it("returns a field error for a blank name without calling createFundingSource", async () => {
    const result = await createFundingSourceAction(
      INITIAL_FUNDING_SOURCE_FORM_STATE,
      fundingSourceFormData({ name: "  " }),
    );

    expect(result.fieldErrors.name).toBe("nameRequired");
    expect(mockedCreateFundingSource).not.toHaveBeenCalled();
  });

  it("creates the funding source and revalidates the list on success", async () => {
    mockedCreateFundingSource.mockResolvedValue({ ok: true });

    const result = await createFundingSourceAction(
      INITIAL_FUNDING_SOURCE_FORM_STATE,
      fundingSourceFormData(),
    );

    expect(result.isSuccess).toBe(true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/funding-sources");
  });

  it("normalises blank notes to null", async () => {
    mockedCreateFundingSource.mockResolvedValue({ ok: true });

    await createFundingSourceAction(
      INITIAL_FUNDING_SOURCE_FORM_STATE,
      fundingSourceFormData({ notes: "" }),
    );

    expect(mockedCreateFundingSource).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null }),
    );
  });

  it("maps a duplicate name to a localised, non-generic message", async () => {
    mockedCreateFundingSource.mockResolvedValue({
      ok: false,
      reason: "DUPLICATE_NAME",
    });

    const result = await createFundingSourceAction(
      INITIAL_FUNDING_SOURCE_FORM_STATE,
      fundingSourceFormData(),
    );

    expect(result.formError).toBe("nameAlreadyUsed");
  });
});

describe("updateFundingSourceAction", () => {
  function updateFormData(overrides: Record<string, string> = {}): FormData {
    return fundingSourceFormData({ id: "funding-source-1", ...overrides });
  }

  it("is refused server-side when requireAdmin rejects a non-admin caller", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      updateFundingSourceAction(
        INITIAL_FUNDING_SOURCE_FORM_STATE,
        updateFormData(),
      ),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedUpdateFundingSource).not.toHaveBeenCalled();
  });

  it("redirects to the list on success", async () => {
    mockedUpdateFundingSource.mockResolvedValue({ ok: true });

    await expect(
      updateFundingSourceAction(
        INITIAL_FUNDING_SOURCE_FORM_STATE,
        updateFormData(),
      ),
    ).rejects.toThrow("REDIRECT");

    expect(mockedRedirect).toHaveBeenCalledWith("/admin/funding-sources");
  });
});

function idFormData(id: string): FormData {
  const formData = new FormData();
  formData.set("id", id);
  return formData;
}

describe("deleteFundingSourceAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller, and never deletes a funding source", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      deleteFundingSourceAction(
        { formError: null },
        idFormData("funding-source-1"),
      ),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedDeleteFundingSource).not.toHaveBeenCalled();
  });

  it("maps a still-referenced funding source — including the race where an asset is assigned it between render and click — to a localised message", async () => {
    mockedDeleteFundingSource.mockResolvedValue({
      ok: false,
      reason: "REFERENCED",
    });

    const result = await deleteFundingSourceAction(
      { formError: null },
      idFormData("funding-source-1"),
    );

    expect(result.formError).toBe("stillReferenced");
  });

  it("deletes and revalidates on success", async () => {
    mockedDeleteFundingSource.mockResolvedValue({ ok: true });

    const result = await deleteFundingSourceAction(
      { formError: null },
      idFormData("funding-source-1"),
    );

    expect(result.formError).toBeNull();
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/funding-sources");
  });
});

describe("deactivateFundingSourceAction / reactivateFundingSourceAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      deactivateFundingSourceAction(idFormData("funding-source-1")),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedSetFundingSourceActive).not.toHaveBeenCalled();
  });

  it("deactivates and revalidates", async () => {
    mockedSetFundingSourceActive.mockResolvedValue({ ok: true });

    await deactivateFundingSourceAction(idFormData("funding-source-1"));

    expect(mockedSetFundingSourceActive).toHaveBeenCalledWith(
      "funding-source-1",
      false,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/funding-sources");
  });

  it("reactivates and revalidates", async () => {
    mockedSetFundingSourceActive.mockResolvedValue({ ok: true });

    await reactivateFundingSourceAction(idFormData("funding-source-1"));

    expect(mockedSetFundingSourceActive).toHaveBeenCalledWith(
      "funding-source-1",
      true,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/funding-sources");
  });
});
