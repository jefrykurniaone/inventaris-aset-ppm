import { describe, expect, it } from "vitest";

import { checkOutSchema } from "./schemas";

/**
 * The check-out submission's shape. The rules that depend on state — is the
 * asset free, is the due date still ahead — live in
 * `src/lib/loan-transitions.ts` and are tested there.
 *
 * The due-date conversion is what earns most of this file. A due date names a
 * *day*, and the instant stored for it has to be the end of that day in
 * `Asia/Jakarta`; storing UTC midnight instead would make every loan overdue
 * from the small hours of the day it is actually due.
 */

const VALID = {
  borrowerName: "Budi Santoso",
  borrowerEmail: "budi@telkomuniversity.ac.id",
  borrowerUnit: "Direktorat PPM",
  dueAt: "2026-08-29",
};

function parse(overrides: Record<string, string> = {}) {
  return checkOutSchema.safeParse({ ...VALID, ...overrides });
}

describe("checkOutSchema", () => {
  it("accepts a well-formed submission", () => {
    expect(parse().success).toBe(true);
  });

  it("stores the due date as the last millisecond of that day in Jakarta", () => {
    const parsed = parse();
    expect(parsed.success).toBe(true);
    // 23:59:59.999+07:00 is 16:59:59.999Z on the same calendar day.
    expect(parsed.success && parsed.data.dueAt.toISOString()).toBe(
      "2026-08-29T16:59:59.999Z",
    );
  });

  it("keeps a due date ahead of UTC midnight of the same day", () => {
    const parsed = parse();
    const utcMidnight = new Date("2026-08-29T00:00:00.000Z");
    expect(parsed.success && parsed.data.dueAt.getTime()).toBeGreaterThan(
      utcMidnight.getTime(),
    );
  });

  it("trims and keeps the borrower's details", () => {
    const parsed = parse({ borrowerName: "  Budi  " });
    expect(parsed.success && parsed.data.borrowerName).toBe("Budi");
  });

  it("reads absent notes as null rather than an empty string", () => {
    const parsed = parse();
    expect(parsed.success && parsed.data.notes).toBeNull();
  });

  it.each<{ label: string; overrides: Record<string, string> }>([
    { label: "an empty borrower name", overrides: { borrowerName: "" } },
    { label: "a whitespace borrower name", overrides: { borrowerName: "  " } },
    { label: "an empty unit", overrides: { borrowerUnit: "" } },
    {
      label: "an address with no domain",
      overrides: { borrowerEmail: "budi@" },
    },
    {
      label: "an address with no at sign",
      overrides: { borrowerEmail: "budi" },
    },
    {
      label: "a due date in the wrong format",
      overrides: { dueAt: "29/08/2026" },
    },
    { label: "a due date with no day", overrides: { dueAt: "2026-08" } },
    { label: "the thirtieth of February", overrides: { dueAt: "2027-02-30" } },
    { label: "a thirteenth month", overrides: { dueAt: "2026-13-01" } },
  ])("rejects $label", ({ overrides }) => {
    expect(parse(overrides).success).toBe(false);
  });

  it("rejects an over-long borrower name", () => {
    expect(parse({ borrowerName: "x".repeat(201) }).success).toBe(false);
  });

  it("rejects over-long notes", () => {
    expect(parse({ notes: "x".repeat(2001) }).success).toBe(false);
  });

  it("names the offending field, so the form can point at it", () => {
    const parsed = parse({ borrowerEmail: "nope" });
    expect(parsed.success).toBe(false);
    expect(parsed.success === false && parsed.error.issues[0].path).toEqual([
      "borrowerEmail",
    ]);
  });
});
