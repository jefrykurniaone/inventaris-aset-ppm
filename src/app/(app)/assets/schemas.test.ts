import { describe, expect, it } from "vitest";

import {
  ASSET_FIELD_NAMES,
  assetSchema,
  EMPTY_ASSET_FORM_DEFAULTS,
} from "./schemas";

/** Bounds are read at validation time, so the fixtures follow the clock
 * rather than pinning a year that stops being valid two New Years from now. */
const CURRENT_YEAR = new Date().getFullYear();

function payload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Mikroskop Binokuler",
    categoryId: "category-1",
    roomId: "room-1",
    condition: "good",
    status: "active",
    acquisitionYear: String(CURRENT_YEAR),
    ...overrides,
  };
}

function firstIssuePath(overrides: Record<string, unknown>): string {
  const parsed = assetSchema.safeParse(payload(overrides));
  if (parsed.success) {
    throw new Error("expected the payload to be rejected");
  }
  return String(parsed.error.issues[0].path[0]);
}

describe("assetSchema — the minimum a submission must carry", () => {
  it("accepts a submission with only the required fields", () => {
    const parsed = assetSchema.safeParse(payload());

    expect(parsed.success).toBe(true);
  });

  it("normalises every omitted optional field to null, not to an empty string", () => {
    const parsed = assetSchema.parse(payload());

    expect(parsed.brand).toBeNull();
    expect(parsed.notes).toBeNull();
    expect(parsed.purchasePrice).toBeNull();
    expect(parsed.fundingSourceId).toBeNull();
    expect(parsed.warrantyUntil).toBeNull();
    expect(parsed.custodianEmail).toBeNull();
  });

  it("trims surrounding whitespace off a name", () => {
    expect(assetSchema.parse(payload({ name: "  Proyektor  " })).name).toBe(
      "Proyektor",
    );
  });

  it.each([
    ["name", { name: "" }],
    ["name", { name: "x".repeat(201) }],
    ["categoryId", { categoryId: "" }],
    ["roomId", { roomId: "" }],
    ["condition", { condition: "excellent" }],
    ["status", { status: "borrowed" }],
    ["notes", { notes: "n".repeat(2001) }],
    ["brand", { brand: "b".repeat(201) }],
    ["custodianEmail", { custodianEmail: "not-an-email" }],
  ])(
    "rejects a bad %s, reporting the issue on that field",
    (field, override) => {
      expect(firstIssuePath(override)).toBe(field);
    },
  );

  it("rejects a payload missing a required field outright", () => {
    const withoutName: Record<string, unknown> = payload();
    delete withoutName.name;

    expect(assetSchema.safeParse(withoutName).success).toBe(false);
  });
});

describe("assetSchema — acquisitionYear", () => {
  it("coerces the submitted string to a number", () => {
    expect(assetSchema.parse(payload()).acquisitionYear).toBe(CURRENT_YEAR);
  });

  it("allows one year ahead, for procurement booked against next year", () => {
    const parsed = assetSchema.safeParse(
      payload({ acquisitionYear: String(CURRENT_YEAR + 1) }),
    );

    expect(parsed.success).toBe(true);
  });

  it.each([
    ["two years ahead", String(CURRENT_YEAR + 2)],
    ["before the register's floor", "1969"],
    ["not a number at all", "last year"],
    ["empty", ""],
    ["fractional", "2026.5"],
  ])("rejects a year that is %s", (_label, acquisitionYear) => {
    expect(firstIssuePath({ acquisitionYear })).toBe("acquisitionYear");
  });
});

describe("assetSchema — purchasePrice", () => {
  it.each([
    ["1500", "1500.00"],
    ["1500.5", "1500.50"],
    ["1500.55", "1500.55"],
    ["0", "0.00"],
  ])("canonicalises %s to %s", (submitted, expected) => {
    expect(
      assetSchema.parse(payload({ purchasePrice: submitted })).purchasePrice,
    ).toBe(expected);
  });

  it.each([
    ["three decimals", "1500.555"],
    ["a thousands separator", "1,500"],
    ["a leading zero", "01500"],
    ["a negative amount", "-1500"],
    ["letters", "seribu"],
    ["more than twelve integer digits", "1234567890123"],
  ])("rejects %s", (_label, purchasePrice) => {
    expect(firstIssuePath({ purchasePrice })).toBe("purchasePrice");
  });
});

describe("assetSchema — warrantyUntil", () => {
  it("parses a date input at UTC midnight, so the stored instant cannot drift", () => {
    const parsed = assetSchema.parse(payload({ warrantyUntil: "2027-03-15" }));

    expect(parsed.warrantyUntil?.toISOString()).toBe(
      "2027-03-15T00:00:00.000Z",
    );
  });

  it.each([
    ["a month that does not exist", "2027-13-01"],
    ["a day that does not exist in that month", "2027-02-30"],
    ["a two-digit year", "27-03-15"],
    ["a day-first date", "15-03-2027"],
    ["a timestamp", "2027-03-15T10:00:00Z"],
  ])("rejects %s", (_label, warrantyUntil) => {
    expect(firstIssuePath({ warrantyUntil })).toBe("warrantyUntil");
  });
});

describe("EMPTY_ASSET_FORM_DEFAULTS", () => {
  it("carries exactly one entry per writable field", () => {
    expect(Object.keys(EMPTY_ASSET_FORM_DEFAULTS).toSorted()).toEqual(
      [...ASSET_FIELD_NAMES].toSorted(),
    );
  });

  it("starts a new asset active, matching the column default", () => {
    expect(EMPTY_ASSET_FORM_DEFAULTS.status).toBe("active");
  });

  it("leaves condition unset, because there is nothing to guess from", () => {
    expect(EMPTY_ASSET_FORM_DEFAULTS.condition).toBe("");
  });
});
