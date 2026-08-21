import { describe, expect, it } from "vitest";

import { buildingIdSchema, buildingSchema } from "./schemas";

describe("buildingSchema", () => {
  it("accepts a valid code and name", () => {
    const result = buildingSchema.safeParse({ code: "GD1", name: "Gedung 1" });
    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = buildingSchema.safeParse({
      code: " GD1 ",
      name: " Gedung 1 ",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.code).toBe("GD1");
  });

  it("rejects an empty code", () => {
    const result = buildingSchema.safeParse({ code: "  ", name: "Gedung 1" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = buildingSchema.safeParse({ code: "GD1", name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a code over 20 characters", () => {
    const result = buildingSchema.safeParse({
      code: "A".repeat(21),
      name: "Gedung 1",
    });
    expect(result.success).toBe(false);
  });
});

describe("buildingIdSchema", () => {
  it("accepts a non-empty id", () => {
    expect(buildingIdSchema.safeParse("building-1").success).toBe(true);
  });

  it("rejects an empty id", () => {
    expect(buildingIdSchema.safeParse("").success).toBe(false);
  });
});
