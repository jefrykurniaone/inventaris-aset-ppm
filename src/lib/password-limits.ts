/**
 * The longest password either form accepts. Matches Better Auth's default
 * `emailAndPassword.maxPasswordLength` (128), which `src/lib/auth.ts` does not
 * override, so a password these forms pass is one `/sign-in/email` and the
 * admin plugin's create-user will not refuse with `PASSWORD_TOO_LONG`.
 *
 * If `auth.ts` ever sets its own `maxPasswordLength`, change this in step.
 */
export const MAX_PASSWORD_LENGTH = 128;
