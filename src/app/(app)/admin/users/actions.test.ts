import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/require-user";

import {
  createUserAction,
  deactivateUserAction,
  reactivateUserAction,
} from "./actions";
import { INITIAL_CREATE_USER_STATE } from "./schemas";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  // Returns each key unchanged, so assertions check *which* message was
  // chosen (behaviour) without depending on its English copy.
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      createUser: vi.fn(),
      banUser: vi.fn(),
      unbanUser: vi.fn(),
    },
  },
}));

vi.mock("@/lib/require-user", () => ({
  requireAdmin: vi.fn(),
}));

const mockedCreateUser = vi.mocked(auth.api.createUser);
const mockedBanUser = vi.mocked(auth.api.banUser);
const mockedUnbanUser = vi.mocked(auth.api.unbanUser);
const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedRevalidatePath = vi.mocked(revalidatePath);

function createUserFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields = {
    name: "New Person",
    email: "new-person@example.invalid",
    password: "a-strong-password",
    role: "staff",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("createUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(
      {} as Awaited<ReturnType<typeof requireAdmin>>,
    );
  });

  it("is refused server-side when requireAdmin rejects a non-admin caller, and never creates a user", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      createUserAction(INITIAL_CREATE_USER_STATE, createUserFormData()),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without calling auth.api.createUser", async () => {
    const result = await createUserAction(
      INITIAL_CREATE_USER_STATE,
      createUserFormData({ email: "not-an-email" }),
    );

    expect(result.fieldErrors.email).toBe("emailInvalid");
    expect(result.isSuccess).toBe(false);
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("creates the user and revalidates the users page on success", async () => {
    mockedCreateUser.mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof auth.api.createUser>>);

    const result = await createUserAction(
      INITIAL_CREATE_USER_STATE,
      createUserFormData(),
    );

    expect(result.isSuccess).toBe(true);
    expect(mockedCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: "new-person@example.invalid" }),
      }),
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("maps an already-registered email to a localised, non-generic message", async () => {
    mockedCreateUser.mockRejectedValue({
      body: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
      message: "User already exists. Use another email.",
    });

    const result = await createUserAction(
      INITIAL_CREATE_USER_STATE,
      createUserFormData(),
    );

    expect(result.formError).toBe("userAlreadyExists");
  });

  it("maps an unrecognised failure to the generic message rather than leaking it", async () => {
    mockedCreateUser.mockRejectedValue(new Error("connection reset by peer"));

    const result = await createUserAction(
      INITIAL_CREATE_USER_STATE,
      createUserFormData(),
    );

    expect(result.formError).toBe("unexpectedError");
  });
});

function userIdFormData(userId: string): FormData {
  const formData = new FormData();
  formData.set("userId", userId);
  return formData;
}

describe("deactivateUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(
      {} as Awaited<ReturnType<typeof requireAdmin>>,
    );
  });

  it("is refused server-side when requireAdmin rejects a non-admin caller, and never bans anyone", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      deactivateUserAction(userIdFormData("user-1")),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedBanUser).not.toHaveBeenCalled();
  });

  it("bans the user and revalidates the users page", async () => {
    await deactivateUserAction(userIdFormData("user-1"));

    expect(mockedBanUser).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: "user-1" } }),
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});

describe("reactivateUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(
      {} as Awaited<ReturnType<typeof requireAdmin>>,
    );
  });

  it("is refused server-side when requireAdmin rejects a non-admin caller, and never unbans anyone", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      reactivateUserAction(userIdFormData("user-1")),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedUnbanUser).not.toHaveBeenCalled();
  });

  it("unbans the user and revalidates the users page", async () => {
    await reactivateUserAction(userIdFormData("user-1"));

    expect(mockedUnbanUser).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: "user-1" } }),
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});
