import { describe, expect, it } from "vitest";

import {
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from "./prisma-errors";

describe("isUniqueConstraintError", () => {
  it("recognises a P2002 error shape", () => {
    expect(
      isUniqueConstraintError({ code: "P2002", meta: { target: ["code"] } }),
    ).toBe(true);
  });

  it("rejects a P2003 error shape", () => {
    expect(isUniqueConstraintError({ code: "P2003" })).toBe(false);
  });

  it("rejects a non-object value", () => {
    expect(isUniqueConstraintError("P2002")).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError(undefined)).toBe(false);
  });

  it("rejects an object with no code field", () => {
    expect(isUniqueConstraintError({ message: "boom" })).toBe(false);
  });

  it("rejects an object whose code is not a string", () => {
    expect(isUniqueConstraintError({ code: 2002 })).toBe(false);
  });
});

describe("isForeignKeyConstraintError", () => {
  it("recognises a P2003 error shape", () => {
    expect(
      isForeignKeyConstraintError({
        code: "P2003",
        meta: { field_name: "categoryId" },
      }),
    ).toBe(true);
  });

  it("rejects a P2002 error shape", () => {
    expect(isForeignKeyConstraintError({ code: "P2002" })).toBe(false);
  });

  it("rejects a non-object value", () => {
    expect(isForeignKeyConstraintError(42)).toBe(false);
  });

  it("rejects an object with no code field", () => {
    expect(isForeignKeyConstraintError({ meta: {} })).toBe(false);
  });
});
