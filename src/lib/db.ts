import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * The only module in the application that imports the generated Prisma client.
 * Everything else imports `db` from here, so moving to a different client — or
 * a different persistence layer entirely — touches this file alone (ADR 0002).
 *
 * Prisma 7 requires a driver adapter, and `@prisma/adapter-pg` serves both
 * environments: local PostgreSQL 17 in development, Supabase Postgres in
 * deployment (ADR 0003). The adapter reads `DATABASE_URL`, which on Supabase is
 * the transaction pooler. Migrations use `DIRECT_URL` and never come through
 * here — see `prisma.config.ts`.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "src/lib/db.ts: DATABASE_URL is not set, so no database connection can be opened.",
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Next.js reloads modules on every edit in development, and a fresh client per
 * reload exhausts the connection pool. The instance is cached on `globalThis`
 * outside production, which is the documented Prisma pattern.
 */
const globalForDb = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

export const db: PrismaClient =
  globalForDb.prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.prismaClient = db;
}
