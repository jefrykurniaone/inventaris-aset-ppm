import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  resolveSeedDemoUser,
  type SeedDemoUserEnvNames,
} from "@/lib/seed-demo-users";

import { STAFF1_ENV_NAMES, STAFF2_ENV_NAMES } from "./demo-users";

/**
 * Seeding the two demonstration `staff` accounts (issue #16), through
 * `auth.api.createUser` in the same headerless, no-session trusted-server
 * context `prisma/seed.ts` already uses for the administrator (issue #41) —
 * never by writing `user`/`account` rows directly, so the password hash
 * stays Better Auth's business.
 *
 * Idempotent on email, same as the administrator: an existing account is
 * left exactly as it is, including its password, and the second run reports
 * that rather than silently doing nothing.
 */

export interface SeedDemoUsersResult {
  readonly staffIds: readonly string[];
  readonly messages: readonly string[];
}

async function ensureDemoUser(
  names: SeedDemoUserEnvNames,
  env: Readonly<Record<string, string | undefined>>,
): Promise<{ readonly id: string; readonly message: string }> {
  const resolution = resolveSeedDemoUser(env, names);
  if (!resolution.ok) {
    throw new Error(
      `prisma/seed-data/demo-users-writer: ${resolution.problems.join(" ")}`,
    );
  }
  const user = resolution.value;

  const existing = await db.user.findUnique({
    where: { email: user.email },
    select: { id: true, role: true },
  });
  if (existing) {
    return {
      id: existing.id,
      message: `${user.email} already exists (role "${existing.role}"); nothing changed. Its password was not touched.`,
    };
  }

  await auth.api.createUser({
    body: {
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
    },
  });
  // Re-read the id rather than trust `createUser`'s own return shape: the
  // administrator's `seedAdmin` in `prisma/seed.ts` does not need this
  // because it never has to hand the id to a later step, but the asset and
  // loan writers here need a real `User.id` to point `createdById` and
  // `handledById` at.
  const created = await db.user.findUniqueOrThrow({
    where: { email: user.email },
    select: { id: true },
  });

  const passwordNote = user.wasPasswordGenerated
    ? `a generated password — ${user.password} — printed here because it is stored nowhere else`
    : "the password from the environment";
  return {
    id: created.id,
    message: `Created staff account ${user.email} with ${passwordNote}.`,
  };
}

export async function seedDemoUsers(
  env: Readonly<Record<string, string | undefined>>,
): Promise<SeedDemoUsersResult> {
  const staff1 = await ensureDemoUser(STAFF1_ENV_NAMES, env);
  const staff2 = await ensureDemoUser(STAFF2_ENV_NAMES, env);
  return {
    staffIds: [staff1.id, staff2.id],
    messages: [staff1.message, staff2.message],
  };
}
