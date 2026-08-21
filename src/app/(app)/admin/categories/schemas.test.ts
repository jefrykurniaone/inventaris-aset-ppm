import { describe, expect, it } from "vitest";

import { categoryIdSchema, categorySchema } from "./schemas";

describe("categorySchema", () => {
  const validInput = {
    code: "LAB",
    name: "Laboratorium",
    nameEn: "Laboratory",
  };

  it("accepts a 2-4 uppercase-letter code", () => {
    for (const code of ["IT", "LAB", "FURN"]) {
      const result = categorySchema.safeParse({ ...validInput, code });
      expect(result.success).toBe(true);
    }
  });

  it("rejects a lowercase code", () => {
    const result = categorySchema.safeParse({ ...validInput, code: "lab" });
    expect(result.success).toBe(false);
  });

  it("rejects a code containing digits", () => {
    const result = categorySchema.safeParse({ ...validInput, code: "LAB1" });
    expect(result.success).toBe(false);
  });

  it("rejects a code shorter than 2 characters", () => {
    const result = categorySchema.safeParse({ ...validInput, code: "L" });
    expect(result.success).toBe(false);
  });

  it("rejects a code longer than 4 characters", () => {
    const result = categorySchema.safeParse({ ...validInput, code: "LABOR" });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace from the code before validating", () => {
    const result = categorySchema.safeParse({ ...validInput, code: " LAB " });
    expect(result.success).toBe(true);
    expect(result.success && result.data.code).toBe("LAB");
  });

  it("rejects an empty name", () => {
    const result = categorySchema.safeParse({ ...validInput, name: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects an empty English name", () => {
    const result = categorySchema.safeParse({ ...validInput, nameEn: "" });
    expect(result.success).toBe(false);
  });
});

describe("categoryIdSchema", () => {
  it("accepts a non-empty id", () => {
    expect(categoryIdSchema.safeParse("category-1").success).toBe(true);
  });

  it("rejects an empty id", () => {
    expect(categoryIdSchema.safeParse("").success).toBe(false);
  });
});
