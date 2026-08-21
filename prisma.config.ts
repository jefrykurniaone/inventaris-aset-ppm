import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration. The datasource URL lives here rather than in
 * `schema.prisma`.
 *
 * The URL below is the one the **CLI** uses — `migrate`, `db`, and
 * introspection. It is therefore `DIRECT_URL`, not `DATABASE_URL`: migrations
 * must never run through a transaction pooler (ADR 0003). The runtime client
 * gets its connection from the `@prisma/adapter-pg` adapter in `src/lib/db.ts`,
 * which reads `DATABASE_URL`. Locally the two strings are identical; on
 * Supabase they are not.
 *
 * Prisma 7 does not load `.env` files by itself, and Next.js is not in the
 * process when the CLI runs, so the development environment file is loaded
 * explicitly. Node's built-in loader is used rather than a `dotenv` dependency.
 * In CI there is no environment file — the variables come from the workflow —
 * so a missing file is expected and not an error.
 */
const DEV_ENV_FILE = ".env.local";

try {
  process.loadEnvFile(DEV_ENV_FILE);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.info(
    `prisma.config.ts: ${DEV_ENV_FILE} not loaded (${reason}); using the ambient environment.`,
  );
}

type PrismaEnv = {
  DIRECT_URL: string;
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env<PrismaEnv>("DIRECT_URL"),
  },
});
