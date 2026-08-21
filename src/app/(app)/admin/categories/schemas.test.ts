import { describe, expect, it } from "vitest";

import { categoryIdSchema, categorySchema } from "./schemas";

describe("categorySchema", () => {
  const validInput = {
    code: "LAB",
    name: "Laboratorium",
    nameEn: "Laboratory",
  };

  it.each(["IT", "LAB", "FURN"])("accepts the code %s", (code) => {
    const result = categorySchema.safeParse({ ...validInput, code });
    expect(result.success).toBe(true);
  });

  // Parameterised rather than five near-identical `it` blocks (SonarQube
  // `typescript:S5976`). The label carries what makes each case distinct, so a
  // failure still names the rule that broke rather than just an input.
  it.each([
    { label: "a lowercase code", code: "lab" },
    { label: "a code containing digits", code: "LAB1" },
    { label: "a code shorter than 2 characters", code: "L" },
    { label: "a code longer than 4 characters", code: "LABOR" },
  ])("rejects $label", ({ code }) => {
    const result = categorySchema.safeParse({ ...validInput, code });
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
