import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { db } from "@/lib/db";

import { readDeactivationReason, recordUserActivity } from "./user-activity";

vi.mock("@/lib/db", () => ({
  db: {
    userActivity: { create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

/**
 * The factory above replaces the whole module, so `db`'s Prisma types no
 * longer describe what is actually there. One cast, here, rather than one per
 * assertion.
 */
const mockedDb = db as unknown as {
  readonly userActivity: { readonly create: Mock };
  readonly user: { readonly findUnique: Mock };
};

const USER_ID = "user-1";
const ACTOR_ID = "admin-1";
const REASON = "Left the directorate on 2026-08-01.";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordUserActivity", () => {
  it("appends one row carrying the account, the admin who acted, and the reason", async () => {
    await recordUserActivity({
      userId: USER_ID,
      actorId: ACTOR_ID,
      type: "deactivated",
      reason: REASON,
    });

    expect(mockedDb.userActivity.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        actorId: ACTOR_ID,
        type: "deactivated",
        reason: REASON,
      },
    });
  });
});

describe("readDeactivationReason", () => {
  it("selects the stored reason and nothing else, so no other column is read", async () => {
    mockedDb.user.findUnique.mockResolvedValue({ banReason: REASON });

    await expect(readDeactivationReason(USER_ID)).resolves.toBe(REASON);
    expect(mockedDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { banReason: true },
    });
  });

  it.each([
    ["no reason is on file", { banReason: null }],
    ["the account no longer exists", null],
  ])("returns the empty string when %s", async (_case, row) => {
    mockedDb.user.findUnique.mockResolvedValue(row);

    await expect(readDeactivationReason(USER_ID)).resolves.toBe("");
  });
});
