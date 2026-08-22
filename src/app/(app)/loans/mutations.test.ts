import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { checkOutInTransaction, returnInTransaction } from "./loan-writes";
import { checkOutAsset, returnLoan } from "./mutations";

/**
 * The transaction boundary itself.
 *
 * `./loan-writes.test.ts` proves that every write goes through the client it is
 * handed. What is left to prove is that the client is a *transaction* client:
 * that both mutations run inside `db.$transaction`, that they hand it straight
 * down, and that a rejection inside the callback comes back out — because
 * `$transaction` rolling back on a rejected callback is what turns "every write
 * on one client" into "both changes land or neither does".
 */

/** Stands in for the client Prisma passes an interactive transaction callback.
 * Identity is all that is checked, so a bare object is enough. */
const TRANSACTION_CLIENT = { marker: "tx" };

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(TRANSACTION_CLIENT),
    ),
  },
}));

vi.mock("./loan-writes", () => ({
  checkOutInTransaction: vi.fn(),
  returnInTransaction: vi.fn(),
}));

const mockedTransaction = vi.mocked(db.$transaction);
const mockedCheckOut = vi.mocked(checkOutInTransaction);
const mockedReturn = vi.mocked(returnInTransaction);

const NOW = new Date("2026-08-22T09:00:00.000Z");
const ACTOR_ID = "user-1";
const LOAN_ID = "loan-1";

const REQUEST = {
  assetId: "asset-1",
  borrowerName: "Budi Santoso",
  borrowerEmail: "budi@telkomuniversity.ac.id",
  borrowerUnit: "Direktorat PPM",
  dueAt: new Date("2026-08-29T16:59:59.999Z"),
  notes: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkOutAsset", () => {
  it("runs the check-out inside one transaction, on the transaction client", async () => {
    mockedCheckOut.mockResolvedValue({ ok: true, loanId: LOAN_ID });

    const result = await checkOutAsset(REQUEST, ACTOR_ID, NOW);

    expect(result).toEqual({ ok: true, loanId: LOAN_ID });
    expect(mockedTransaction).toHaveBeenCalledTimes(1);
    expect(mockedCheckOut).toHaveBeenCalledWith(
      TRANSACTION_CLIENT,
      REQUEST,
      ACTOR_ID,
      NOW,
    );
  });

  it("passes a refusal straight back without opening a second transaction", async () => {
    mockedCheckOut.mockResolvedValue({
      ok: false,
      reason: "ASSET_ALREADY_LOANED",
    });

    await expect(checkOutAsset(REQUEST, ACTOR_ID, NOW)).resolves.toEqual({
      ok: false,
      reason: "ASSET_ALREADY_LOANED",
    });
    expect(mockedTransaction).toHaveBeenCalledTimes(1);
  });

  it("lets a mid-operation failure escape, so the transaction rolls back", async () => {
    mockedCheckOut.mockRejectedValue(new Error("write failed half way"));

    await expect(checkOutAsset(REQUEST, ACTOR_ID, NOW)).rejects.toThrow(
      "write failed half way",
    );
  });

  it("stamps its own instant when the caller gives none", async () => {
    mockedCheckOut.mockResolvedValue({ ok: true, loanId: LOAN_ID });

    await checkOutAsset(REQUEST, ACTOR_ID);

    expect(mockedCheckOut.mock.calls[0][3]).toBeInstanceOf(Date);
  });
});

describe("returnLoan", () => {
  it("runs the return inside one transaction, on the transaction client", async () => {
    mockedReturn.mockResolvedValue({ ok: true, assetId: "asset-1" });

    const result = await returnLoan(LOAN_ID, ACTOR_ID, NOW);

    expect(result).toEqual({ ok: true, assetId: "asset-1" });
    expect(mockedTransaction).toHaveBeenCalledTimes(1);
    expect(mockedReturn).toHaveBeenCalledWith(
      TRANSACTION_CLIENT,
      LOAN_ID,
      ACTOR_ID,
      NOW,
    );
  });

  it("lets a mid-operation failure escape, so the transaction rolls back", async () => {
    mockedReturn.mockRejectedValue(new Error("write failed half way"));

    await expect(returnLoan(LOAN_ID, ACTOR_ID, NOW)).rejects.toThrow(
      "write failed half way",
    );
  });

  it("stamps its own instant when the caller gives none", async () => {
    mockedReturn.mockResolvedValue({ ok: true, assetId: "asset-1" });

    await returnLoan(LOAN_ID, ACTOR_ID);

    expect(mockedReturn.mock.calls[0][3]).toBeInstanceOf(Date);
  });
});
