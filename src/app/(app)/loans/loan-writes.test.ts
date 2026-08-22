import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionClient } from "@/app/(app)/assets/activity-writes";
import type { AssetStatus } from "@/app/(app)/assets/schemas";

import {
  checkOutInTransaction,
  returnInTransaction,
  type CheckOutRequest,
} from "./loan-writes";

/**
 * Check-out and return, driven against a fake transaction client.
 *
 * The point of these tests is not that Prisma works. It is that **every write
 * goes through the one client the function was handed**, so that opening a real
 * transaction around either function is enough to make it atomic — and that a
 * failure part way through propagates rather than being swallowed, which is
 * what makes the surrounding `db.$transaction` roll the earlier writes back.
 * `./loan-writes.ts` imports `db` only as a type, so there is no second path to
 * the database for a write to escape down; the recorder below sees all of them.
 */

const NOW = new Date("2026-08-22T09:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const ASSET_ID = "asset-1";
const ACTOR_ID = "user-1";
const LOAN_ID = "loan-1";

const CHECK_OUT: CheckOutRequest = {
  assetId: ASSET_ID,
  borrowerName: "Budi Santoso",
  borrowerEmail: "budi@telkomuniversity.ac.id",
  borrowerUnit: "Direktorat PPM",
  dueAt: new Date(NOW.getTime() + 7 * DAY_MS),
  notes: null,
};

interface FakeOptions {
  readonly assetStatus?: AssetStatus | null;
  readonly claimCount?: number;
  readonly loan?: { assetId: string; returnedAt: Date | null } | null;
  readonly closeCount?: number;
  readonly throwOn?: string;
}

interface Fake {
  readonly tx: TransactionClient;
  readonly calls: string[];
  readonly activityPayloads: unknown[];
}

/**
 * A transaction client that records the name of every operation performed on
 * it, in order, and throws from one named operation when asked to.
 *
 * Cast rather than implemented: the real client carries every delegate on the
 * schema, and a faithful implementation would assert nothing these tests do not
 * already assert through the call log.
 */
function createFake(options: FakeOptions = {}): Fake {
  const calls: string[] = [];
  const activityPayloads: unknown[] = [];

  function record<T>(name: string, result: T): T {
    calls.push(name);
    if (options.throwOn === name) {
      throw new Error(`fake failure in ${name}`);
    }
    return result;
  }

  const tx = {
    asset: {
      findFirst: vi.fn(async () =>
        record(
          "asset.findFirst",
          options.assetStatus === undefined || options.assetStatus === null
            ? null
            : { status: options.assetStatus },
        ),
      ),
      updateMany: vi.fn(async () =>
        record("asset.updateMany", { count: options.claimCount ?? 1 }),
      ),
      update: vi.fn(async () => record("asset.update", { id: ASSET_ID })),
    },
    loan: {
      create: vi.fn(async () => record("loan.create", { id: LOAN_ID })),
      findUnique: vi.fn(async () =>
        record("loan.findUnique", options.loan ?? null),
      ),
      updateMany: vi.fn(async () =>
        record("loan.updateMany", { count: options.closeCount ?? 1 }),
      ),
    },
    assetActivity: {
      create: vi.fn(async (args: { data: { payload: unknown } }) => {
        activityPayloads.push(args.data.payload);
        return record("assetActivity.create", { id: "activity-1" });
      }),
    },
  };

  return { tx: tx as unknown as TransactionClient, calls, activityPayloads };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkOutInTransaction", () => {
  it("claims the asset, opens the loan and writes the trail, in that order", async () => {
    const fake = createFake({ assetStatus: "active" });

    const result = await checkOutInTransaction(
      fake.tx,
      CHECK_OUT,
      ACTOR_ID,
      NOW,
    );

    expect(result).toEqual({ ok: true, loanId: LOAN_ID });
    expect(fake.calls).toEqual([
      "asset.findFirst",
      "asset.updateMany",
      "loan.create",
      "assetActivity.create",
    ]);
  });

  it("writes a loaned payload carrying no borrower personal data", async () => {
    const fake = createFake({ assetStatus: "active" });

    await checkOutInTransaction(fake.tx, CHECK_OUT, ACTOR_ID, NOW);

    const payload = JSON.stringify(fake.activityPayloads[0]);
    expect(payload).toContain(LOAN_ID);
    for (const secret of [
      CHECK_OUT.borrowerName,
      CHECK_OUT.borrowerEmail,
      CHECK_OUT.borrowerUnit,
    ]) {
      expect(payload).not.toContain(secret);
    }
  });

  it.each([
    {
      label: "the asset is missing",
      assetStatus: null,
      reason: "ASSET_NOT_FOUND",
    },
    {
      label: "the asset is already loaned",
      assetStatus: "loaned" as AssetStatus,
      reason: "ASSET_ALREADY_LOANED",
    },
    {
      label: "the asset is retired",
      assetStatus: "retired" as AssetStatus,
      reason: "ASSET_NOT_AVAILABLE",
    },
  ])(
    "refuses with $reason when $label, writing nothing",
    async ({ assetStatus, reason }) => {
      const fake = createFake({ assetStatus });

      const result = await checkOutInTransaction(
        fake.tx,
        CHECK_OUT,
        ACTOR_ID,
        NOW,
      );

      expect(result).toEqual({ ok: false, reason });
      expect(fake.calls).toEqual(["asset.findFirst"]);
    },
  );

  it("refuses a due date that has already passed, writing nothing", async () => {
    const fake = createFake({ assetStatus: "active" });

    const result = await checkOutInTransaction(
      fake.tx,
      { ...CHECK_OUT, dueAt: new Date(NOW.getTime() - DAY_MS) },
      ACTOR_ID,
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "DUE_DATE_IN_PAST" });
    expect(fake.calls).toEqual(["asset.findFirst"]);
  });

  it("refuses when the conditional claim loses the race, opening no loan", async () => {
    const fake = createFake({ assetStatus: "active", claimCount: 0 });

    const result = await checkOutInTransaction(
      fake.tx,
      CHECK_OUT,
      ACTOR_ID,
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "ASSET_ALREADY_LOANED" });
    expect(fake.calls).toEqual(["asset.findFirst", "asset.updateMany"]);
  });

  it.each(["loan.create", "assetActivity.create"])(
    "propagates a failure in %s rather than reporting success",
    async (throwOn) => {
      const fake = createFake({ assetStatus: "active", throwOn });

      await expect(
        checkOutInTransaction(fake.tx, CHECK_OUT, ACTOR_ID, NOW),
      ).rejects.toThrow(`fake failure in ${throwOn}`);
      expect(fake.calls).toContain("asset.updateMany");
      expect(fake.calls.at(-1)).toBe(throwOn);
    },
  );
});

describe("returnInTransaction", () => {
  const OPEN_LOAN = { assetId: ASSET_ID, returnedAt: null };

  it("closes the loan, frees the asset and writes the trail, in that order", async () => {
    const fake = createFake({ loan: OPEN_LOAN });

    const result = await returnInTransaction(fake.tx, LOAN_ID, ACTOR_ID, NOW);

    expect(result).toEqual({ ok: true, assetId: ASSET_ID });
    expect(fake.calls).toEqual([
      "loan.findUnique",
      "loan.updateMany",
      "asset.update",
      "assetActivity.create",
    ]);
  });

  it("writes a returned payload carrying no borrower personal data", async () => {
    const fake = createFake({ loan: OPEN_LOAN });

    await returnInTransaction(fake.tx, LOAN_ID, ACTOR_ID, NOW);

    expect(fake.activityPayloads[0]).toEqual({
      loanId: LOAN_ID,
      returnedAt: NOW.toISOString(),
    });
  });

  it.each([
    { label: "the loan is missing", loan: null, reason: "LOAN_NOT_FOUND" },
    {
      label: "the loan was already returned",
      loan: { assetId: ASSET_ID, returnedAt: new Date(NOW.getTime() - DAY_MS) },
      reason: "LOAN_ALREADY_RETURNED",
    },
  ])(
    "refuses with $reason when $label, writing nothing",
    async ({ loan, reason }) => {
      const fake = createFake({ loan });

      const result = await returnInTransaction(fake.tx, LOAN_ID, ACTOR_ID, NOW);

      expect(result).toEqual({ ok: false, reason });
      expect(fake.calls).toEqual(["loan.findUnique"]);
    },
  );

  it("refuses a second return that loses the race, leaving the asset alone", async () => {
    const fake = createFake({ loan: OPEN_LOAN, closeCount: 0 });

    const result = await returnInTransaction(fake.tx, LOAN_ID, ACTOR_ID, NOW);

    expect(result).toEqual({ ok: false, reason: "LOAN_ALREADY_RETURNED" });
    expect(fake.calls).toEqual(["loan.findUnique", "loan.updateMany"]);
  });

  it.each(["asset.update", "assetActivity.create"])(
    "propagates a failure in %s rather than reporting success",
    async (throwOn) => {
      const fake = createFake({ loan: OPEN_LOAN, throwOn });

      await expect(
        returnInTransaction(fake.tx, LOAN_ID, ACTOR_ID, NOW),
      ).rejects.toThrow(`fake failure in ${throwOn}`);
      expect(fake.calls).toContain("loan.updateMany");
      expect(fake.calls.at(-1)).toBe(throwOn);
    },
  );
});
