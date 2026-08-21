import { z } from "zod";

/**
 * Shared shape for the sign-in form's inline validation. This is a client-
 * side convenience only — the authoritative server-side validation for
 * `/api/auth/sign-in/email` lives inside Better Auth itself (email format,
 * password length), since that route is the one exception this project's
 * seam rules make to "only `src/lib/auth.ts` and `src/lib/auth-client.ts`
 * import Better Auth": the sign-in form calls `authClient.signIn.email`
 * directly rather than through a server action of this project's own.
 */
export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type SignInInput = z.infer<typeof signInSchema>;
