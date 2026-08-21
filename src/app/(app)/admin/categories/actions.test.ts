import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/require-user";

import {
  createCategoryAction,
  deactivateCategoryAction,
  deleteCategoryAction,
  reactivateCategoryAction,
  updateCategoryAction,
} from "./actions";
import {
  createCategory,
  deleteCategory,
  setCategoryActive,
  updateCategory,
} from "./mutations";
import { INITIAL_CATEGORY_FORM_STATE } from "./schemas";

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
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  setCategoryActive: vi.fn(),
}));

const mockedCreateCategory = vi.mocked(createCategory);
const mockedUpdateCategory = vi.mocked(updateCategory);
const mockedDeleteCategory = vi.mocked(deleteCategory);
const mockedSetCategoryActive = vi.mocked(setCategoryActive);
const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRedirect = vi.mocked(redirect);

function categoryFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields = {
    code: "LAB",
    name: "Laboratorium",
    nameEn: "Laboratory",
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

describe("createCategoryAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller, and never creates a category", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      createCategoryAction(INITIAL_CATEGORY_FORM_STATE, categoryFormData()),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedCreateCategory).not.toHaveBeenCalled();
  });

  it("returns a field error for a lowercase code without calling createCategory", async () => {
    const result = await createCategoryAction(
      INITIAL_CATEGORY_FORM_STATE,
      categoryFormData({ code: "lab" }),
    );

    expect(result.fieldErrors.code).toBe("codeInvalid");
    expect(mockedCreateCategory).not.toHaveBeenCalled();
  });

  it("returns a field error for a code carrying digits", async () => {
    const result = await createCategoryAction(
      INITIAL_CATEGORY_FORM_STATE,
      categoryFormData({ code: "LAB1" }),
    );

    expect(result.fieldErrors.code).toBe("codeInvalid");
  });

  it("creates the category and revalidates the list on success", async () => {
    mockedCreateCategory.mockResolvedValue({ ok: true });

    const result = await createCategoryAction(
      INITIAL_CATEGORY_FORM_STATE,
      categoryFormData(),
    );

    expect(result.isSuccess).toBe(true);
    expect(mockedCreateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ code: "LAB" }),
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/categories");
  });

  it("maps a duplicate code to a localised, non-generic message", async () => {
    mockedCreateCategory.mockResolvedValue({
      ok: false,
      reason: "DUPLICATE_CODE",
    });

    const result = await createCategoryAction(
      INITIAL_CATEGORY_FORM_STATE,
      categoryFormData(),
    );

    expect(result.formError).toBe("codeAlreadyUsed");
  });
});

describe("updateCategoryAction", () => {
  function updateFormData(overrides: Record<string, string> = {}): FormData {
    return categoryFormData({ id: "category-1", ...overrides });
  }

  it("is refused server-side when requireAdmin rejects a non-admin caller, and never updates a category", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      updateCategoryAction(INITIAL_CATEGORY_FORM_STATE, updateFormData()),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedUpdateCategory).not.toHaveBeenCalled();
  });

  it("maps an immutable code to a localised, non-generic message", async () => {
    mockedUpdateCategory.mockResolvedValue({
      ok: false,
      reason: "CODE_IMMUTABLE",
    });

    const result = await updateCategoryAction(
      INITIAL_CATEGORY_FORM_STATE,
      updateFormData(),
    );

    expect(result.formError).toBe("codeImmutable");
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("redirects to the list on success", async () => {
    mockedUpdateCategory.mockResolvedValue({ ok: true });

    await expect(
      updateCategoryAction(INITIAL_CATEGORY_FORM_STATE, updateFormData()),
    ).rejects.toThrow("REDIRECT");

    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/categories");
    expect(mockedRedirect).toHaveBeenCalledWith("/admin/categories");
  });
});

function idFormData(id: string): FormData {
  const formData = new FormData();
  formData.set("id", id);
  return formData;
}

describe("deleteCategoryAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller, and never deletes a category", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      deleteCategoryAction({ formError: null }, idFormData("category-1")),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedDeleteCategory).not.toHaveBeenCalled();
  });

  it("deletes and revalidates on success", async () => {
    mockedDeleteCategory.mockResolvedValue({ ok: true });

    const result = await deleteCategoryAction(
      { formError: null },
      idFormData("category-1"),
    );

    expect(result.formError).toBeNull();
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/categories");
  });

  it("maps a referenced category — including the race where a reference appears between render and click — to a localised message instead of raising", async () => {
    mockedDeleteCategory.mockResolvedValue({ ok: false, reason: "REFERENCED" });

    const result = await deleteCategoryAction(
      { formError: null },
      idFormData("category-1"),
    );

    expect(result.formError).toBe("stillReferenced");
  });
});

describe("deactivateCategoryAction / reactivateCategoryAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller, and never changes activation", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      deactivateCategoryAction(idFormData("category-1")),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedSetCategoryActive).not.toHaveBeenCalled();
  });

  it("deactivates and revalidates", async () => {
    mockedSetCategoryActive.mockResolvedValue({ ok: true });

    await deactivateCategoryAction(idFormData("category-1"));

    expect(mockedSetCategoryActive).toHaveBeenCalledWith("category-1", false);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/categories");
  });

  it("reactivates and revalidates", async () => {
    mockedSetCategoryActive.mockResolvedValue({ ok: true });

    await reactivateCategoryAction(idFormData("category-1"));

    expect(mockedSetCategoryActive).toHaveBeenCalledWith("category-1", true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/categories");
  });
});
