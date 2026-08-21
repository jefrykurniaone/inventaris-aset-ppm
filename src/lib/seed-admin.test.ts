import { describe, expect, it } from "vitest";

import {
  ALLOW_REMOTE_ENV,
  DEFAULT_SEED_ADMIN_EMAIL,
  DEFAULT_SEED_ADMIN_NAME,
  decideSeedTarget,
  isLocalDatabaseUrl,
  resolveSeedAdmin,
} from "./seed-admin";

const LOCAL_URL =
  "postgresql://inventaris:pw@localhost:5432/inventaris_aset_ppm?schema=public";
const SUPABASE_POOLER_URL =
  "postgresql://postgres.abcdefgh:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";
const GOOD_PASSWORD = "a-long-enough-password";

describe("isLocalDatabaseUrl", () => {
  it.each([
    { label: "localhost", url: LOCAL_URL },
    { label: "127.0.0.1", url: "postgresql://u:p@127.0.0.1:5432/db" },
    { label: "bracketed IPv6 loopback", url: "postgresql://u:p@[::1]:5432/db" },
  ])("accepts $label", ({ url }) => {
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it("rejects the Supabase transaction pooler from .env.example", () => {
    expect(isLocalDatabaseUrl(SUPABASE_POOLER_URL)).toBe(false);
  });

  // Fails closed: an allow-list means anything unparseable is not local, so a
  // malformed connection string cannot be mistaken for a development database.
  it.each([
    { label: "an empty string", url: "" },
    { label: "text that is not a URL", url: "not a url at all" },
    {
      label: "a host that merely contains localhost",
      url: "postgresql://u:p@localhost.evil.example:5432/db",
    },
    { label: "a lookalike host", url: "postgresql://u:p@my-localhost:5432/db" },
  ])("rejects $label", ({ url }) => {
    expect(isLocalDatabaseUrl(url)).toBe(false);
  });
});

describe("resolveSeedAdmin", () => {
  it("uses the development defaults for email and name", () => {
    const result = resolveSeedAdmin({ SEED_ADMIN_PASSWORD: GOOD_PASSWORD });

    expect(result).toEqual({
      ok: true,
      value: {
        email: DEFAULT_SEED_ADMIN_EMAIL,
        name: DEFAULT_SEED_ADMIN_NAME,
        password: GOOD_PASSWORD,
      },
    });
  });

  it("prefers the environment over the defaults", () => {
    const result = resolveSeedAdmin({
      SEED_ADMIN_EMAIL: "ppm.admin@telkomuniversity.ac.id",
      SEED_ADMIN_NAME: "Direktorat PPM",
      SEED_ADMIN_PASSWORD: GOOD_PASSWORD,
    });

    expect(result.ok && result.value.email).toBe(
      "ppm.admin@telkomuniversity.ac.id",
    );
    expect(result.ok && result.value.name).toBe("Direktorat PPM");
  });

  // The point of the module: there is no default password, so an absent one is
  // a refusal that names the variable rather than a silent fallback.
  it("refuses when the password is absent, naming the variable", () => {
    const result = resolveSeedAdmin({});

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems).toEqual([
      expect.stringContaining("SEED_ADMIN_PASSWORD"),
    ]);
  });

  it("refuses a password that is too short", () => {
    const result = resolveSeedAdmin({ SEED_ADMIN_PASSWORD: "short" });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems).toEqual([
      expect.stringContaining("at least 12 characters"),
    ]);
  });

  it("refuses an invalid email and reports only that problem", () => {
    const result = resolveSeedAdmin({
      SEED_ADMIN_EMAIL: "not-an-email",
      SEED_ADMIN_PASSWORD: GOOD_PASSWORD,
    });

    expect(!result.ok && result.problems).toEqual([
      expect.stringContaining("SEED_ADMIN_EMAIL"),
    ]);
  });

  it("refuses a blank name", () => {
    const result = resolveSeedAdmin({
      SEED_ADMIN_NAME: "   ",
      SEED_ADMIN_PASSWORD: GOOD_PASSWORD,
    });

    expect(!result.ok && result.problems).toEqual([
      expect.stringContaining("SEED_ADMIN_NAME"),
    ]);
  });

  it("reports every problem at once, without duplicates", () => {
    const result = resolveSeedAdmin({
      SEED_ADMIN_EMAIL: "nope",
      SEED_ADMIN_NAME: "",
    });

    expect(!result.ok && result.problems).toHaveLength(3);
  });
});

describe("decideSeedTarget", () => {
  it("allows a local database", () => {
    expect(decideSeedTarget({ DATABASE_URL: LOCAL_URL })).toEqual({
      ok: true,
      isRemote: false,
    });
  });

  it("refuses a Supabase database by default", () => {
    const decision = decideSeedTarget({ DATABASE_URL: SUPABASE_POOLER_URL });

    expect(decision.ok).toBe(false);
    expect(!decision.ok && decision.reason).toContain(ALLOW_REMOTE_ENV);
  });

  it("allows a remote database only on an explicit opt-in", () => {
    expect(
      decideSeedTarget({
        DATABASE_URL: SUPABASE_POOLER_URL,
        [ALLOW_REMOTE_ENV]: "true",
      }),
    ).toEqual({ ok: true, isRemote: true });
  });

  it.each(["1", "yes", "TRUE", ""])(
    "does not treat %o as the opt-in",
    (value) => {
      const decision = decideSeedTarget({
        DATABASE_URL: SUPABASE_POOLER_URL,
        [ALLOW_REMOTE_ENV]: value,
      });

      expect(decision.ok).toBe(false);
    },
  );

  it("refuses when DATABASE_URL is missing", () => {
    const decision = decideSeedTarget({});

    expect(!decision.ok && decision.reason).toBe("DATABASE_URL is not set.");
  });
});
