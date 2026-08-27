import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { db } from "@/lib/db";

import { readSignInLockState, recordSignInAttempt } from "./sign-in-attempts";
import {
  SIGN_IN_FAILURE_THRESHOLD,
  SIGN_IN_LOCK_DURATION_MS,
  signInAttemptRetentionCutoff,
} from "./sign-in-lockout";

vi.mock("@/lib/db", () => ({
  db: {
    signInAttempt: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

/**
 * The factory above replaces the whole module, so `db`'s Prisma types no longer
 * describe what is actually there. One cast, here, rather than one per
 * assertion — the same shape `user-activity.test.ts` uses.
 */
const mockedDb = db as unknown as {
  readonly signInAttempt: {
    readonly findMany: Mock;
    readonly create: Mock;
    readonly deleteMany: Mock;
  };
  readonly $transaction: Mock;
};

const NOW = new Date("2026-08-27T12:00:00.000Z");
const SUBMITTED_EMAIL = "  Admin@Example.Invalid ";
const NORMALISED_EMAIL = "admin@example.invalid";

function failedRows(count: number, createdAt: Date = NOW) {
  return Array.from({ length: count }, () => ({
    outcome: "failed" as const,
    createdAt,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("readSignInLockState", () => {
  it("asks only for the newest rows the policy can act on", async () => {
    mockedDb.signInAttempt.findMany.mockResolvedValue([]);

    await readSignInLockState(SUBMITTED_EMAIL, NOW);

    expect(mockedDb.signInAttempt.findMany).toHaveBeenCalledWith({
      where: { email: NORMALISED_EMAIL, outcome: { not: "blocked" } },
      orderBy: { createdAt: "desc" },
      take: SIGN_IN_FAILURE_THRESHOLD,
      select: { outcome: true, createdAt: true },
    });
  });

  it("reports a lock once the stored failures reach the threshold", async () => {
    mockedDb.signInAttempt.findMany.mockResolvedValue(
      failedRows(SIGN_IN_FAILURE_THRESHOLD),
    );

    const state = await readSignInLockState(SUBMITTED_EMAIL, NOW);

    expect(state).toEqual({
      isLocked: true,
      lockedUntil: new Date(NOW.getTime() + SIGN_IN_LOCK_DURATION_MS),
    });
  });

  it("reports no lock below the threshold", async () => {
    mockedDb.signInAttempt.findMany.mockResolvedValue(
      failedRows(SIGN_IN_FAILURE_THRESHOLD - 1),
    );

    await expect(readSignInLockState(SUBMITTED_EMAIL, NOW)).resolves.toEqual({
      isLocked: false,
      lockedUntil: null,
    });
  });

  it("fails open and logs when the log cannot be read", async () => {
    mockedDb.signInAttempt.findMany.mockRejectedValue(
      new Error("connection terminated"),
    );

    await expect(readSignInLockState(SUBMITTED_EMAIL, NOW)).resolves.toEqual({
      isLocked: false,
      lockedUntil: null,
    });
    expect(console.error).toHaveBeenCalledOnce();
  });
});

describe("recordSignInAttempt", () => {
  it("appends the attempt against the normalised address", async () => {
    await recordSignInAttempt(SUBMITTED_EMAIL, "failed", NOW);

    expect(mockedDb.signInAttempt.create).toHaveBeenCalledWith({
      data: { email: NORMALISED_EMAIL, outcome: "failed" },
    });
    expect(mockedDb.$transaction).toHaveBeenCalledOnce();
  });

  it("drops that address's rows past retention in the same round trip", async () => {
    await recordSignInAttempt(SUBMITTED_EMAIL, "succeeded", NOW);

    expect(mockedDb.signInAttempt.deleteMany).toHaveBeenCalledWith({
      where: {
        email: NORMALISED_EMAIL,
        createdAt: { lt: signInAttemptRetentionCutoff(NOW) },
      },
    });
  });

  it("logs and swallows a write failure rather than failing the sign-in", async () => {
    mockedDb.$transaction.mockRejectedValue(new Error("deadlock detected"));

    await expect(
      recordSignInAttempt(SUBMITTED_EMAIL, "blocked", NOW),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("keeps the submitted address out of the error log", async () => {
    mockedDb.$transaction.mockRejectedValue(new Error("deadlock detected"));

    await recordSignInAttempt(SUBMITTED_EMAIL, "failed", NOW);

    const logged = vi.mocked(console.error).mock.calls[0]?.[0] as string;
    expect(logged).not.toContain(NORMALISED_EMAIL);
    expect(logged).toContain("failed");
  });
});
