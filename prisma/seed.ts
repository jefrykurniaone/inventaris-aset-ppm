/**
 * Seeds the first administrator, so a freshly migrated database can be signed
 * into at all (issue #41).
 *
 * Without this, a clean environment is unreachable: `emailAndPassword`
 * has `disableSignUp` set (FR-1.1, no public self-registration), and
 * `/admin/create-user` needs an existing admin session — so a database with
 * zero users has no path to a first one, and `README.md`'s getting-started
 * sequence dead-ends at a sign-in form nobody can pass.
 *
 * `prisma.config.ts` points `migrations.seed` here, so `prisma migrate reset`
 * and `npm run db:seed` both run this file.
 *
 * The demonstration dataset — categories, buildings, rooms, funding sources,
 * sixty assets, photos, loans, activity — is issue #16, and will build on top
 * of this.
 *
 * ## How the administrator is created
 *
 * Through `auth.api.createUser` with **no headers and no request**. The admin
 * plugin's guard reads `if (!session && (ctx.request || ctx.headers)) throw
 * UNAUTHORIZED`, so a headerless server-side call is treated as a trusted
 * server context and let through without a session. That is the legitimate
 * mechanism for a seed, and it is also why `requireAdmin()` rather than the
 * library's own check is this project's authorisation boundary — established
 * by issue #4.
 *
 * Going through `src/lib/auth.ts` rather than writing `user` and `account`
 * rows directly is deliberate: the password hash is Better Auth's business,
 * and hand-rolling it would couple this script to the library's internals
 * while bypassing the seam rule that only `src/lib/auth.ts` configures it.
 *
 * ## Idempotency
 *
 * Keyed on the email, which is unique in the schema. An existing account is
 * promoted to `admin` if it is not one already, and **its password is never
 * rewritten** — silently changing a working credential because somebody re-ran
 * the seed is worse than doing nothing.
 *
 * The account is never deleted and recreated. Every `User` foreign key in the
 * schema is `onDelete: Restrict` (issue #3), so once the seeded administrator
 * owns any asset, photo, loan or activity row, a delete-first reseed would
 * fail — and it would fail confusingly, as a foreign-key error from the script
 * whose whole job is setup.
 *
 * Run it with:
 *
 *     npm run db:seed
 *
 * The process exits on its own. A non-zero exit code means nothing was
 * written.
 */
import { ADMIN_ROLE } from "@/lib/roles";
import {
  decideSeedTarget,
  resolveSeedAdmin,
  type SeedAdminInput,
} from "@/lib/seed-admin";

/** Development environment file. Prisma does not load it by itself. */
const DEV_ENV_FILE = ".env.local";

const EXIT_REFUSED = 1;

function loadDevEnv(): void {
  try {
    process.loadEnvFile(DEV_ENV_FILE);
  } catch {
    // Absent in CI and in deployment, where the variables are already set.
    console.info(
      `prisma/seed.ts: ${DEV_ENV_FILE} not loaded; using the ambient environment.`,
    );
  }
}

function refuse(lines: readonly string[]): never {
  for (const line of lines) {
    console.error(`prisma/seed.ts: ${line}`);
  }
  process.exit(EXIT_REFUSED);
}

/**
 * Creates the administrator, or reports that it is already there.
 *
 * Returns what happened so the caller can say so on stdout — a seed that
 * prints nothing on a second run gives no way to tell "already correct" from
 * "silently did nothing".
 */
async function seedAdmin(admin: SeedAdminInput): Promise<string> {
  const { auth } = await import("@/lib/auth");
  const { db } = await import("@/lib/db");

  const existing = await db.user.findUnique({
    where: { email: admin.email },
    select: { id: true, role: true },
  });

  if (existing) {
    if (existing.role === ADMIN_ROLE) {
      return `${admin.email} already exists as an administrator; nothing changed.`;
    }
    await db.user.update({
      where: { id: existing.id },
      data: { role: ADMIN_ROLE },
    });
    return `${admin.email} already existed with role "${existing.role}" and was promoted to administrator. Its password was not touched.`;
  }

  await auth.api.createUser({
    body: {
      name: admin.name,
      email: admin.email,
      password: admin.password,
      role: ADMIN_ROLE,
    },
  });
  return `Created administrator ${admin.email}. Sign in with the password from SEED_ADMIN_PASSWORD.`;
}

async function main(): Promise<void> {
  loadDevEnv();

  const target = decideSeedTarget(process.env);
  if (!target.ok) {
    refuse([target.reason, "Nothing was written."]);
  }
  if (target.isRemote) {
    console.warn(
      "prisma/seed.ts: seeding a NON-LOCAL database, because SEED_ALLOW_REMOTE=true.",
    );
  }

  const admin = resolveSeedAdmin(process.env);
  if (!admin.ok) {
    refuse([...admin.problems, "Nothing was written."]);
  }

  const outcome = await seedAdmin(admin.value);
  console.info(`prisma/seed.ts: ${outcome}`);

  const { db } = await import("@/lib/db");
  await db.$disconnect();
}

// `main().catch(...)` rather than a top-level `await`, matching the scripts in
// `scripts/`. The package is CommonJS, so tsx's esbuild transform rejects
// top-level await outright: "Top-level await is currently not supported with
// the cjs output format".
main().catch((error: unknown) => {
  console.error("prisma/seed.ts: seeding failed. Nothing was written.");
  console.error(error);
  process.exitCode = 1;
});
