import { describe, expect, it } from "vitest";

import { fundingSourceIdSchema, fundingSourceSchema } from "./schemas";

describe("fundingSourceSchema", () => {
  it("accepts a valid name with notes", () => {
    const result = fundingSourceSchema.safeParse({
      name: "Hibah Penelitian",
      notes: "Dana penelitian tahun 2026",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid name with no notes", () => {
    const result = fundingSourceSchema.safeParse({ name: "Hibah Penelitian" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.notes).toBeNull();
  });

  it("normalises blank notes to null", () => {
    const result = fundingSourceSchema.safeParse({
      name: "Hibah Penelitian",
      notes: "   ",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.notes).toBeNull();
  });

  it("rejects an empty name", () => {
    const result = fundingSourceSchema.safeParse({ name: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects notes over 500 characters", () => {
    const result = fundingSourceSchema.safeParse({
      name: "Hibah Penelitian",
      notes: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("fundingSourceIdSchema", () => {
  it("accepts a non-empty id", () => {
    expect(fundingSourceIdSchema.safeParse("funding-source-1").success).toBe(
      true,
    );
  });

  it("rejects an empty id", () => {
    expect(fundingSourceIdSchema.safeParse("").success).toBe(false);
  });
});
