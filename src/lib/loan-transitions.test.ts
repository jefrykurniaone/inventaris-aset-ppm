import { describe, expect, it } from "vitest";

import type { AssetStatus } from "@/app/(app)/assets/schemas";

import {
  CHECK_OUT_FROM_STATUS,
  isLoanOpen,
  isLoanOverdue,
  loanStateOf,
  refuseCheckOut,
  refuseReturn,
  RETURN_TO_STATUS,
  type CheckOutRefusal,
  type LoanState,
  type ReturnRefusal,
} from "./loan-transitions";

/** A fixed instant, so no assertion here depends on when the suite runs. */
const NOW = new Date("2026-08-22T09:00:00.000Z");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

describe("isLoanOpen", () => {
  it.each([
    { label: "no return recorded", returnedAt: null, expected: true },
    { label: "a return recorded", returnedAt: at(-DAY_MS), expected: false },
  ])("is $expected for $label", ({ returnedAt, expected }) => {
    expect(isLoanOpen({ returnedAt })).toBe(expected);
  });
});

describe("isLoanOverdue", () => {
  it.each<{
    label: string;
    dueAt: Date;
    returnedAt: Date | null;
    expected: boolean;
  }>([
    {
      label: "an open loan due tomorrow",
      dueAt: at(DAY_MS),
      returnedAt: null,
      expected: false,
    },
    {
      label: "an open loan due exactly now",
      dueAt: at(0),
      returnedAt: null,
      expected: false,
    },
    {
      label: "an open loan one millisecond past its due date",
      dueAt: at(-1),
      returnedAt: null,
      expected: true,
    },
    {
      label: "an open loan a week past its due date",
      dueAt: at(-7 * DAY_MS),
      returnedAt: null,
      expected: true,
    },
    {
      label: "a returned loan that came back late",
      dueAt: at(-7 * DAY_MS),
      returnedAt: at(-DAY_MS),
      expected: false,
    },
    {
      label: "a returned loan that came back on time",
      dueAt: at(DAY_MS),
      returnedAt: at(-HOUR_MS),
      expected: false,
    },
  ])("is $expected for $label", ({ dueAt, returnedAt, expected }) => {
    expect(isLoanOverdue({ dueAt, returnedAt }, NOW)).toBe(expected);
  });
});

describe("loanStateOf", () => {
  it.each<{
    label: string;
    dueAt: Date;
    returnedAt: Date | null;
    expected: LoanState;
  }>([
    {
      label: "open and not yet due",
      dueAt: at(3 * DAY_MS),
      returnedAt: null,
      expected: "active",
    },
    {
      label: "open and past due",
      dueAt: at(-3 * DAY_MS),
      returnedAt: null,
      expected: "overdue",
    },
    {
      label: "returned, however late",
      dueAt: at(-30 * DAY_MS),
      returnedAt: at(-DAY_MS),
      expected: "returned",
    },
  ])("is $expected when $label", ({ dueAt, returnedAt, expected }) => {
    expect(loanStateOf({ dueAt, returnedAt }, NOW)).toBe(expected);
  });

  it("never reports a state outside the declared three", () => {
    const state = loanStateOf({ dueAt: at(-1), returnedAt: null }, NOW);
    expect(["active", "overdue", "returned"]).toContain(state);
  });
});

describe("refuseCheckOut", () => {
  const FUTURE_DUE = at(7 * DAY_MS);

  it("allows a future due date on an active asset", () => {
    expect(refuseCheckOut(CHECK_OUT_FROM_STATUS, FUTURE_DUE, NOW)).toBeNull();
  });

  it.each<{
    label: string;
    status: AssetStatus | null;
    dueAt: Date;
    expected: CheckOutRefusal;
  }>([
    {
      label: "the asset row is missing",
      status: null,
      dueAt: FUTURE_DUE,
      expected: "ASSET_NOT_FOUND",
    },
    {
      label: "the asset is already out on loan",
      status: "loaned",
      dueAt: FUTURE_DUE,
      expected: "ASSET_ALREADY_LOANED",
    },
    {
      label: "the asset is in repair",
      status: "in_repair",
      dueAt: FUTURE_DUE,
      expected: "ASSET_NOT_AVAILABLE",
    },
    {
      label: "the asset is retired",
      status: "retired",
      dueAt: FUTURE_DUE,
      expected: "ASSET_NOT_AVAILABLE",
    },
    {
      label: "the asset is lost",
      status: "lost",
      dueAt: FUTURE_DUE,
      expected: "ASSET_NOT_AVAILABLE",
    },
    {
      label: "the due date is yesterday",
      status: "active",
      dueAt: at(-DAY_MS),
      expected: "DUE_DATE_IN_PAST",
    },
    {
      label: "the due date is the present instant",
      status: "active",
      dueAt: at(0),
      expected: "DUE_DATE_IN_PAST",
    },
  ])("refuses with $expected when $label", ({ status, dueAt, expected }) => {
    expect(refuseCheckOut(status, dueAt, NOW)).toBe(expected);
  });

  it("reports the loan refusal, not the generic one, for a loaned asset", () => {
    expect(refuseCheckOut("loaned", at(-DAY_MS), NOW)).toBe(
      "ASSET_ALREADY_LOANED",
    );
  });
});

describe("refuseReturn", () => {
  it("allows returning an open loan", () => {
    expect(refuseReturn({ returnedAt: null })).toBeNull();
  });

  it.each<{
    label: string;
    loan: { returnedAt: Date | null } | null;
    expected: ReturnRefusal;
  }>([
    {
      label: "the loan row is missing",
      loan: null,
      expected: "LOAN_NOT_FOUND",
    },
    {
      label: "the loan was already returned",
      loan: { returnedAt: at(-DAY_MS) },
      expected: "LOAN_ALREADY_RETURNED",
    },
  ])("refuses with $expected when $label", ({ loan, expected }) => {
    expect(refuseReturn(loan)).toBe(expected);
  });
});

describe("status constants", () => {
  it("checks out from and returns to the same idle status", () => {
    expect(CHECK_OUT_FROM_STATUS).toBe("active");
    expect(RETURN_TO_STATUS).toBe("active");
  });
});
