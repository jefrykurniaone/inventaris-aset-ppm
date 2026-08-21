import { describe, expect, it } from "vitest";

import { roomBuildingFilterSchema, roomIdSchema, roomSchema } from "./schemas";

describe("roomSchema", () => {
  const validInput = {
    buildingId: "building-1",
    code: "101",
    name: "Ruang 101",
  };

  it("accepts a valid room", () => {
    expect(roomSchema.safeParse(validInput).success).toBe(true);
  });

  it("requires a building (PRD FR-3.3)", () => {
    const result = roomSchema.safeParse({ ...validInput, buildingId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty code", () => {
    const result = roomSchema.safeParse({ ...validInput, code: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = roomSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const result = roomSchema.safeParse({ ...validInput, code: " 101 " });
    expect(result.success).toBe(true);
    expect(result.success && result.data.code).toBe("101");
  });
});

describe("roomIdSchema", () => {
  it("accepts a non-empty id", () => {
    expect(roomIdSchema.safeParse("room-1").success).toBe(true);
  });

  it("rejects an empty id", () => {
    expect(roomIdSchema.safeParse("").success).toBe(false);
  });
});

describe("roomBuildingFilterSchema", () => {
  it("passes a non-empty value through", () => {
    expect(roomBuildingFilterSchema.parse("building-1")).toBe("building-1");
  });

  it('normalises an empty string to undefined ("all buildings")', () => {
    expect(roomBuildingFilterSchema.parse("")).toBeUndefined();
  });

  it("normalises a missing value to undefined", () => {
    expect(roomBuildingFilterSchema.parse(undefined)).toBeUndefined();
  });
});
