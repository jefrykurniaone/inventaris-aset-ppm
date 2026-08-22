import type { SeedDemoUserEnvNames } from "@/lib/seed-demo-users";

/** The two demonstration `staff` accounts (issue #16). The administrator is
 * already seeded by issue #41's `seedAdmin` in `prisma/seed.ts` — these are
 * the other two of the ticket's "3 users: one admin, two staff". */
export const STAFF1_ENV_NAMES: SeedDemoUserEnvNames = {
  emailEnv: "SEED_STAFF1_EMAIL",
  nameEnv: "SEED_STAFF1_NAME",
  passwordEnv: "SEED_STAFF1_PASSWORD",
  defaultEmail: "staff1@example.invalid",
  defaultName: "PPM Staff Satu",
};

export const STAFF2_ENV_NAMES: SeedDemoUserEnvNames = {
  emailEnv: "SEED_STAFF2_EMAIL",
  nameEnv: "SEED_STAFF2_NAME",
  passwordEnv: "SEED_STAFF2_PASSWORD",
  defaultEmail: "staff2@example.invalid",
  defaultName: "PPM Staff Dua",
};
