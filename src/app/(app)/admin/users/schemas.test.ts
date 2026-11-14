import { describe, expect, it } from "vitest";

import { MAX_PASSWORD_LENGTH } from "@/lib/password-limits";

import { createUserSchema } from "./schemas";

function parseWithPassword(password: string) {
  return createUserSchema.safeParse({
    name: "New Person",
    email: "new-person@example.invalid",
    password,
    role: "staff",
  });
}

describe("createUserSchema password length", () => {
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

  it("refuses a password under the minimum, as too_small on password", () => {
    const result = parseWithPassword("short");

    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["password"], code: "too_small" }),
    ]);
  });
});
