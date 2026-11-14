import { describe, expect, it } from "vitest";

import { MAX_PASSWORD_LENGTH } from "@/lib/password-limits";

import { signInSchema } from "./sign-in-schema";

function parseWithPassword(password: string) {
  return signInSchema.safeParse({ email: "staff@example.invalid", password });
}

describe("signInSchema password length", () => {
  it("accepts a password of exactly the maximum length", () => {
    expect(parseWithPassword("a".repeat(MAX_PASSWORD_LENGTH)).success).toBe(
      true,
    );
  });

  it("refuses a password one character over the maximum, as too_big on password", () => {
    const result = parseWithPassword("a".repeat(MAX_PASSWORD_LENGTH + 1));

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["password"], code: "too_big" }),
    ]);
  });

  it("refuses an empty password, as too_small on password", () => {
    const result = parseWithPassword("");

    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["password"], code: "too_small" }),
    ]);
  });
});
