import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/require-user";

import {
  createRoomAction,
  deactivateRoomAction,
  deleteRoomAction,
  reactivateRoomAction,
  updateRoomAction,
} from "./actions";
import { createRoom, deleteRoom, setRoomActive, updateRoom } from "./mutations";
import { INITIAL_ROOM_FORM_STATE } from "./schemas";

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
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
  setRoomActive: vi.fn(),
}));

const mockedCreateRoom = vi.mocked(createRoom);
const mockedUpdateRoom = vi.mocked(updateRoom);
const mockedDeleteRoom = vi.mocked(deleteRoom);
const mockedSetRoomActive = vi.mocked(setRoomActive);
const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRedirect = vi.mocked(redirect);

function roomFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields = {
    buildingId: "building-1",
    code: "101",
    name: "Ruang 101",
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

describe("createRoomAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller, and never creates a room", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      createRoomAction(INITIAL_ROOM_FORM_STATE, roomFormData()),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedCreateRoom).not.toHaveBeenCalled();
  });

  it("returns a field error when no building is selected, without calling createRoom", async () => {
    const result = await createRoomAction(
      INITIAL_ROOM_FORM_STATE,
      roomFormData({ buildingId: "" }),
    );

    expect(result.fieldErrors.buildingId).toBe("buildingRequired");
    expect(mockedCreateRoom).not.toHaveBeenCalled();
  });

  it("creates the room and revalidates the list on success", async () => {
    mockedCreateRoom.mockResolvedValue({ ok: true });

    const result = await createRoomAction(
      INITIAL_ROOM_FORM_STATE,
      roomFormData(),
    );

    expect(result.isSuccess).toBe(true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/rooms");
  });

  it("maps a duplicate code within the building to a localised message", async () => {
    mockedCreateRoom.mockResolvedValue({ ok: false, reason: "DUPLICATE_CODE" });

    const result = await createRoomAction(
      INITIAL_ROOM_FORM_STATE,
      roomFormData(),
    );

    expect(result.formError).toBe("codeAlreadyUsed");
  });

  it("maps an invalid building to a localised message", async () => {
    mockedCreateRoom.mockResolvedValue({
      ok: false,
      reason: "INVALID_BUILDING",
    });

    const result = await createRoomAction(
      INITIAL_ROOM_FORM_STATE,
      roomFormData(),
    );

    expect(result.formError).toBe("invalidBuilding");
  });
});

describe("updateRoomAction", () => {
  function updateFormData(overrides: Record<string, string> = {}): FormData {
    return roomFormData({ id: "room-1", ...overrides });
  }

  it("is refused server-side when requireAdmin rejects a non-admin caller", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      updateRoomAction(INITIAL_ROOM_FORM_STATE, updateFormData()),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedUpdateRoom).not.toHaveBeenCalled();
  });

  it("redirects to the list on success", async () => {
    mockedUpdateRoom.mockResolvedValue({ ok: true });

    await expect(
      updateRoomAction(INITIAL_ROOM_FORM_STATE, updateFormData()),
    ).rejects.toThrow("REDIRECT");

    expect(mockedRedirect).toHaveBeenCalledWith("/admin/rooms");
  });
});

function idFormData(id: string): FormData {
  const formData = new FormData();
  formData.set("id", id);
  return formData;
}

describe("deleteRoomAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller, and never deletes a room", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(
      deleteRoomAction({ formError: null }, idFormData("room-1")),
    ).rejects.toThrow("REDIRECT:/not-authorized");

    expect(mockedDeleteRoom).not.toHaveBeenCalled();
  });

  it("maps a still-referenced room — including the race where an asset is moved in between render and click — to a localised message", async () => {
    mockedDeleteRoom.mockResolvedValue({ ok: false, reason: "REFERENCED" });

    const result = await deleteRoomAction(
      { formError: null },
      idFormData("room-1"),
    );

    expect(result.formError).toBe("stillReferenced");
  });

  it("deletes and revalidates on success", async () => {
    mockedDeleteRoom.mockResolvedValue({ ok: true });

    const result = await deleteRoomAction(
      { formError: null },
      idFormData("room-1"),
    );

    expect(result.formError).toBeNull();
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/rooms");
  });
});

describe("deactivateRoomAction / reactivateRoomAction", () => {
  it("is refused server-side when requireAdmin rejects a non-admin caller", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("REDIRECT:/not-authorized"));

    await expect(deactivateRoomAction(idFormData("room-1"))).rejects.toThrow(
      "REDIRECT:/not-authorized",
    );

    expect(mockedSetRoomActive).not.toHaveBeenCalled();
  });

  it("deactivates and revalidates", async () => {
    mockedSetRoomActive.mockResolvedValue({ ok: true });

    await deactivateRoomAction(idFormData("room-1"));

    expect(mockedSetRoomActive).toHaveBeenCalledWith("room-1", false);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/rooms");
  });

  it("reactivates and revalidates", async () => {
    mockedSetRoomActive.mockResolvedValue({ ok: true });

    await reactivateRoomAction(idFormData("room-1"));

    expect(mockedSetRoomActive).toHaveBeenCalledWith("room-1", true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/rooms");
  });
});
