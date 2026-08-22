import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireUser } from "@/lib/require-user";

import { checkOutAssetAction, returnLoanAction } from "./actions";
import { checkOutAsset, returnLoan } from "./mutations";
import { INITIAL_LOAN_FORM_STATE, INITIAL_RETURN_LOAN_STATE } from "./schemas";

/**
 * The action layer: authorisation first, then validation, then the mapping
 * from a mutation's refusal onto a localised message. The mutations themselves
 * are mocked — `./loan-writes.test.ts` and `./mutations.test.ts` own those.
 *
 * `getTranslations` is stubbed to the identity, so an assertion names the
 * message *key*. That is the thing worth pinning: the wording belongs to the
 * catalogue, the choice of key belongs here.
 */

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/require-user", () => ({
  requireUser: vi.fn(),
}));

vi.mock("./mutations", () => ({
  checkOutAsset: vi.fn(),
  returnLoan: vi.fn(),
}));

const mockedRequireUser = vi.mocked(requireUser);
const mockedCheckOutAsset = vi.mocked(checkOutAsset);
const mockedReturnLoan = vi.mocked(returnLoan);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const ACTOR_ID = "user-1";
const ASSET_ID = "asset-1";
const LOAN_ID = "loan-1";

function checkOutFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    assetId: ASSET_ID,
    borrowerName: "Budi Santoso",
    borrowerEmail: "budi@telkomuniversity.ac.id",
    borrowerUnit: "Direktorat PPM",
    dueAt: "2027-01-15",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function returnFormData(loanId: string = LOAN_ID): FormData {
  const formData = new FormData();
  formData.set("loanId", loanId);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireUser.mockResolvedValue({
    id: ACTOR_ID,
  } as Awaited<ReturnType<typeof requireUser>>);
});

describe("checkOutAssetAction", () => {
  it("checks the asset out and revalidates the surfaces it changed", async () => {
    mockedCheckOutAsset.mockResolvedValue({ ok: true, loanId: LOAN_ID });

    const state = await checkOutAssetAction(
      INITIAL_LOAN_FORM_STATE,
      checkOutFormData(),
    );

    expect(state).toEqual({
      fieldErrors: {},
      formError: null,
      isSuccess: true,
    });
    expect(mockedCheckOutAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: ASSET_ID,
        borrowerName: "Budi Santoso",
        notes: null,
      }),
      ACTOR_ID,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/loans");
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/assets/${ASSET_ID}`);
  });

  it("refuses to run at all without a session", async () => {
    mockedRequireUser.mockRejectedValue(new Error("REDIRECT:/sign-in"));

    await expect(
      checkOutAssetAction(INITIAL_LOAN_FORM_STATE, checkOutFormData()),
    ).rejects.toThrow("REDIRECT:/sign-in");
    expect(mockedCheckOutAsset).not.toHaveBeenCalled();
  });

  it.each([
    { label: "an empty borrower name", field: "borrowerName", value: "" },
    { label: "a malformed email", field: "borrowerEmail", value: "not-email" },
    { label: "an empty unit", field: "borrowerUnit", value: "" },
    { label: "a due date that is not a date", field: "dueAt", value: "soon" },
    { label: "a day that does not exist", field: "dueAt", value: "2027-02-30" },
  ])(
    "reports a field error for $label, and writes nothing",
    async ({ field, value }) => {
      const state = await checkOutAssetAction(
        INITIAL_LOAN_FORM_STATE,
        checkOutFormData({ [field]: value }),
      );

      expect(state.fieldErrors).toHaveProperty(field);
      expect(state.isSuccess).toBe(false);
      expect(mockedCheckOutAsset).not.toHaveBeenCalled();
    },
  );

  it("puts a past due date under the field the user typed it into", async () => {
    mockedCheckOutAsset.mockResolvedValue({
      ok: false,
      reason: "DUE_DATE_IN_PAST",
    });

    const state = await checkOutAssetAction(
      INITIAL_LOAN_FORM_STATE,
      checkOutFormData(),
    );

    expect(state).toEqual({
      fieldErrors: { dueAt: "dueAtInPast" },
      formError: null,
      isSuccess: false,
    });
  });

  it.each([
    { reason: "ASSET_ALREADY_LOANED", key: "assetAlreadyLoaned" },
    { reason: "ASSET_NOT_AVAILABLE", key: "assetNotAvailable" },
    { reason: "ASSET_NOT_FOUND", key: "assetNotFound" },
  ] as const)(
    "reports $key above the form when the mutation refuses with $reason",
    async ({ reason, key }) => {
      mockedCheckOutAsset.mockResolvedValue({ ok: false, reason });

      const state = await checkOutAssetAction(
        INITIAL_LOAN_FORM_STATE,
        checkOutFormData(),
      );

      expect(state).toEqual({
        fieldErrors: {},
        formError: key,
        isSuccess: false,
      });
      expect(mockedRevalidatePath).not.toHaveBeenCalled();
    },
  );

  it("keeps optional notes when given and drops them when blank", async () => {
    mockedCheckOutAsset.mockResolvedValue({ ok: true, loanId: LOAN_ID });

    await checkOutAssetAction(
      INITIAL_LOAN_FORM_STATE,
      checkOutFormData({ notes: "Dipakai untuk workshop" }),
    );
    expect(mockedCheckOutAsset).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "Dipakai untuk workshop" }),
      ACTOR_ID,
    );

    await checkOutAssetAction(
      INITIAL_LOAN_FORM_STATE,
      checkOutFormData({ notes: "   " }),
    );
    expect(mockedCheckOutAsset).toHaveBeenLastCalledWith(
      expect.objectContaining({ notes: null }),
      ACTOR_ID,
    );
  });
});

describe("returnLoanAction", () => {
  it("records the return and revalidates the asset it freed", async () => {
    mockedReturnLoan.mockResolvedValue({ ok: true, assetId: ASSET_ID });

    const state = await returnLoanAction(
      INITIAL_RETURN_LOAN_STATE,
      returnFormData(),
    );

    expect(state).toEqual(INITIAL_RETURN_LOAN_STATE);
    expect(mockedReturnLoan).toHaveBeenCalledWith(LOAN_ID, ACTOR_ID);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/assets/${ASSET_ID}`);
  });

  it("refuses to run at all without a session", async () => {
    mockedRequireUser.mockRejectedValue(new Error("REDIRECT:/sign-in"));

    await expect(
      returnLoanAction(INITIAL_RETURN_LOAN_STATE, returnFormData()),
    ).rejects.toThrow("REDIRECT:/sign-in");
    expect(mockedReturnLoan).not.toHaveBeenCalled();
  });

  it.each([
    { reason: "LOAN_ALREADY_RETURNED", key: "loanAlreadyReturned" },
    { reason: "LOAN_NOT_FOUND", key: "loanNotFound" },
  ] as const)(
    "reports $key when the mutation refuses with $reason",
    async ({ reason, key }) => {
      mockedReturnLoan.mockResolvedValue({ ok: false, reason });

      const state = await returnLoanAction(
        INITIAL_RETURN_LOAN_STATE,
        returnFormData(),
      );

      expect(state).toEqual({ formError: key });
      expect(mockedRevalidatePath).not.toHaveBeenCalled();
    },
  );
});
