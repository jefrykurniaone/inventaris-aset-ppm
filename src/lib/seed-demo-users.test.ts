import { describe, expect, it } from "vitest";

import { STAFF_ROLE } from "@/lib/roles";

import {
  resolveSeedDemoUser,
  type SeedDemoUserEnvNames,
} from "./seed-demo-users";

const NAMES: SeedDemoUserEnvNames = {
  emailEnv: "SEED_STAFF1_EMAIL",
  nameEnv: "SEED_STAFF1_NAME",
  passwordEnv: "SEED_STAFF1_PASSWORD",
  defaultEmail: "staff1@example.invalid",
  defaultName: "PPM Staff One",
};

describe("resolveSeedDemoUser", () => {
  it("uses the development defaults and generates a password", () => {
    const result = resolveSeedDemoUser({}, NAMES);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.email).toBe(NAMES.defaultEmail);
    expect(result.value.name).toBe(NAMES.defaultName);
    expect(result.value.role).toBe(STAFF_ROLE);
    expect(result.value.wasPasswordGenerated).toBe(true);
    expect(result.value.password.length).toBeGreaterThanOrEqual(12);
  });

  it("prefers the environment over the defaults, for all three fields", () => {
    const result = resolveSeedDemoUser(
      {
        SEED_STAFF1_EMAIL: "budi.santoso@mail.invalid",
        SEED_STAFF1_NAME: "Budi Santoso",
        SEED_STAFF1_PASSWORD: "a-long-enough-password",
      },
      NAMES,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toMatchObject({
      email: "budi.santoso@mail.invalid",
      name: "Budi Santoso",
      password: "a-long-enough-password",
      wasPasswordGenerated: false,
    });
  });

  it("generates a different password on each call when none is set", () => {
    const first = resolveSeedDemoUser({}, NAMES);
    const second = resolveSeedDemoUser({}, NAMES);

    expect(first.ok && second.ok).toBe(true);
    expect(first.ok && second.ok && first.value.password).not.toBe(
      second.ok && second.value.password,
    );
  });

  it("refuses a password from the environment that is too short", () => {
    const result = resolveSeedDemoUser(
      { SEED_STAFF1_PASSWORD: "short" },
      NAMES,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems).toEqual([
      expect.stringContaining("SEED_STAFF1_PASSWORD"),
    ]);
  });

  it("refuses an invalid email and reports only that problem", () => {
    const result = resolveSeedDemoUser(
      { SEED_STAFF1_EMAIL: "not-an-email" },
      NAMES,
    );

    expect(!result.ok && result.problems).toEqual([
      expect.stringContaining("SEED_STAFF1_EMAIL"),
    ]);
  });

  it("refuses a blank name", () => {
    const result = resolveSeedDemoUser({ SEED_STAFF1_NAME: "   " }, NAMES);

    expect(!result.ok && result.problems).toEqual([
      expect.stringContaining("SEED_STAFF1_NAME"),
    ]);
  });
});
