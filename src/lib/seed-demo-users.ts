import { nanoid } from "nanoid";
import { z } from "zod";

import { STAFF_ROLE } from "@/lib/roles";

/**
 * Resolving the two demonstration `staff` accounts issue #16 seeds, alongside
 * the administrator issue #41 already seeds.
 *
 * Same shape as `src/lib/seed-admin.ts` and deliberately not merged into it:
 * that module's whole point is that the administrator's password has **no**
 * default, because a known admin credential is the worst thing to leave in a
 * repository. A demonstration `staff` account is lower stakes, and the
 * ticket allows either an environment variable or a generated-and-printed
 * password — `resolveSeedAdmin` has no branch for that second option, and
 * bolting one on would weaken the one guarantee that module exists for.
 *
 * Pure and testable for the same reason `seed-admin.ts` is: `prisma/seed.ts`
 * is a plain script, not a test target, so the decision logic has to live
 * somewhere a Vitest run actually reaches — `src/lib/**` is what
 * `vitest.config.mts` instruments.
 */

const MIN_PASSWORD_LENGTH = 12;

/** Longer than the minimum a human might type, since nobody has to remember
 * this one — it is printed once and then lives in a password manager or is
 * never used again because `SEED_STAFFn_PASSWORD` was set instead. */
const GENERATED_PASSWORD_LENGTH = 20;

/** Names the four environment variables one demonstration user reads from. */
export interface SeedDemoUserEnvNames {
  readonly emailEnv: string;
  readonly nameEnv: string;
  readonly passwordEnv: string;
  readonly defaultEmail: string;
  readonly defaultName: string;
}

const demoUserSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

export interface SeedDemoUserInput {
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly role: typeof STAFF_ROLE;
  /** Whether the password came from `nanoid` rather than the environment —
   * so the caller knows whether it must be printed for anyone to use it. */
  readonly wasPasswordGenerated: boolean;
}

export type SeedDemoUserResolution =
  | { readonly ok: true; readonly value: SeedDemoUserInput }
  | { readonly ok: false; readonly problems: readonly string[] };

/** `nanoid` draws from `crypto.getRandomValues`, never `Math.random()`
 * (S2245) — the same rule `src/lib/qr-token.ts` follows, for the same
 * reason: this value is a credential, not a display id. */
function generatePassword(): string {
  return nanoid(GENERATED_PASSWORD_LENGTH);
}

function describeProblem(
  field: PropertyKey | undefined,
  names: SeedDemoUserEnvNames,
): string {
  if (field === "email") {
    return `${names.emailEnv} is not a valid email address.`;
  }
  if (field === "name") {
    return `${names.nameEnv} must not be blank.`;
  }
  if (field === "password") {
    return `${names.passwordEnv} must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return "A demonstration staff account's configuration is invalid.";
}

/**
 * Reads one demonstration `staff` account's details from the environment.
 *
 * Email and name fall back to development defaults, same as the
 * administrator's. The password falls back to a generated one instead of
 * refusing outright — `wasPasswordGenerated` tells `prisma/seed.ts` whether
 * it has to print that password, since a generated credential nobody sees is
 * useless rather than merely inconvenient.
 */
export function resolveSeedDemoUser(
  env: Readonly<Record<string, string | undefined>>,
  names: SeedDemoUserEnvNames,
): SeedDemoUserResolution {
  const passwordFromEnv = env[names.passwordEnv];
  const wasPasswordGenerated = passwordFromEnv === undefined;

  const parsed = demoUserSchema.safeParse({
    email: env[names.emailEnv] ?? names.defaultEmail,
    name: env[names.nameEnv] ?? names.defaultName,
    password: passwordFromEnv ?? generatePassword(),
  });

  if (!parsed.success) {
    const problems = [
      ...new Set(
        parsed.error.issues.map((issue) =>
          describeProblem(issue.path[0], names),
        ),
      ),
    ];
    return { ok: false, problems };
  }

  return {
    ok: true,
    value: { ...parsed.data, role: STAFF_ROLE, wasPasswordGenerated },
  };
}
