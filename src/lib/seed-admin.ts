/**
 * The decisions `prisma/seed.ts` has to make before it writes anything: which
 * credentials the first administrator gets, and whether the database it is
 * pointed at may be written to at all.
 *
 * Both are pure functions here rather than inline in the script, so that they
 * can be tested. `src/lib` already holds one module used only from outside the
 * running application — `globals-css-tokens.ts`, which exists for the contrast
 * suite — so this is the established place for it rather than a new pattern.
 *
 * Messages in this module are developer-facing command-line output, not user
 * interface text, so they are deliberately not routed through `next-intl`.
 */
import { z } from "zod";

/**
 * A seeded administrator is the most valuable credential in the system, so the
 * floor here is higher than Better Auth's own default of eight. Raising a
 * minimum is always safe; the library still applies its own check underneath.
 */
const MIN_PASSWORD_LENGTH = 12;

/** Hosts that mean "the PostgreSQL 17 instance on this machine" (ADR 0003). */
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** `new URL` keeps an IPv6 host inside brackets; `::1` arrives as `[::1]`. */
const SURROUNDING_BRACKETS = /^\[|\]$/g;

export const DEFAULT_SEED_ADMIN_EMAIL = "admin@example.invalid";
export const DEFAULT_SEED_ADMIN_NAME = "PPM Administrator";

/**
 * Whether a connection string points at a local development database.
 *
 * Deliberately an allow-list of local hosts rather than a deny-list of known
 * production hosts. A deny-list has to anticipate every hostname a deployment
 * might ever use, and the failure mode when it misses one is seeding a live
 * database. This fails closed instead: anything unrecognised, including a
 * string that is not a URL at all, is treated as not local.
 */
export function isLocalDatabaseUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return LOCAL_DATABASE_HOSTS.has(hostname.replace(SURROUNDING_BRACKETS, ""));
}

export const seedAdminSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

export type SeedAdminInput = z.infer<typeof seedAdminSchema>;

const PROBLEM_BY_FIELD: Readonly<Record<string, string>> = {
  email: "SEED_ADMIN_EMAIL is not a valid email address.",
  name: "SEED_ADMIN_NAME must not be blank.",
  password: `SEED_ADMIN_PASSWORD must be set, and at least ${MIN_PASSWORD_LENGTH} characters. It is never read from a committed file.`,
};

const UNKNOWN_PROBLEM = "The seed administrator configuration is invalid.";

function describeProblem(field: PropertyKey | undefined): string {
  if (typeof field !== "string") {
    return UNKNOWN_PROBLEM;
  }
  return PROBLEM_BY_FIELD[field] ?? UNKNOWN_PROBLEM;
}

export type SeedAdminResolution =
  | { readonly ok: true; readonly value: SeedAdminInput }
  | { readonly ok: false; readonly problems: readonly string[] };

/**
 * Reads the first administrator's details from the environment.
 *
 * The email and the display name have development defaults, because getting
 * either wrong is recoverable through the user-management screen. **The
 * password has none.** A default password would survive into whatever
 * environment somebody next ran the seed in, and a known administrator
 * credential is the single worst thing to leave lying in a repository — so an
 * absent `SEED_ADMIN_PASSWORD` is a refusal, naming the variable, rather than a
 * fallback.
 */
export function resolveSeedAdmin(
  env: Readonly<Record<string, string | undefined>>,
): SeedAdminResolution {
  const parsed = seedAdminSchema.safeParse({
    email: env.SEED_ADMIN_EMAIL ?? DEFAULT_SEED_ADMIN_EMAIL,
    name: env.SEED_ADMIN_NAME ?? DEFAULT_SEED_ADMIN_NAME,
    password: env.SEED_ADMIN_PASSWORD ?? "",
  });

  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  const problems = [
    ...new Set(
      parsed.error.issues.map((issue) => describeProblem(issue.path[0])),
    ),
  ];
  return { ok: false, problems };
}

/** The opt-in that allows seeding something other than a local database. */
export const ALLOW_REMOTE_ENV = "SEED_ALLOW_REMOTE";
const ALLOW_REMOTE_VALUE = "true";

export type SeedTargetDecision =
  | { readonly ok: true; readonly isRemote: boolean }
  | { readonly ok: false; readonly reason: string };

/**
 * Whether the seed may write to the database `DATABASE_URL` names.
 *
 * `DATABASE_URL` and not `DIRECT_URL`, because the seed writes through Prisma
 * Client at runtime rather than through `prisma migrate` (ADR 0003).
 */
export function decideSeedTarget(
  env: Readonly<Record<string, string | undefined>>,
): SeedTargetDecision {
  const url = env.DATABASE_URL;
  if (!url) {
    return { ok: false, reason: "DATABASE_URL is not set." };
  }
  if (isLocalDatabaseUrl(url)) {
    return { ok: true, isRemote: false };
  }
  if (env[ALLOW_REMOTE_ENV] === ALLOW_REMOTE_VALUE) {
    return { ok: true, isRemote: true };
  }
  return {
    ok: false,
    reason: `DATABASE_URL does not point at a local database, so this looks like a deployment. Set ${ALLOW_REMOTE_ENV}=${ALLOW_REMOTE_VALUE} if seeding it is genuinely what you want.`,
  };
}
