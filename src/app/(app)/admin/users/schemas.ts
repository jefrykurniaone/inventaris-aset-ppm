import { z } from "zod";

import type { auth } from "@/lib/auth";
import { roleSchema } from "@/lib/roles";

/**
 * Matches Better Auth's default `emailAndPassword.minPasswordLength`
 * (`src/lib/auth.ts` does not override it), so this form's validation agrees
 * with what `auth.api.createUser` will actually accept.
 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * A "use server" file may only export async functions (Next.js enforces
 * this at build time), so these schemas — and the constant above — live
 * here rather than in `actions.ts`, and are imported into it.
 */
export const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  role: roleSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Better Auth's user IDs are opaque strings; only "present" is checkable. */
export const userIdSchema = z.string().min(1);

type CreateUserFieldErrors = Partial<
  Record<"name" | "email" | "password", string>
>;

/**
 * `createUserAction`'s return shape. Declared here rather than in
 * `actions.ts` for the same reason as the schemas above: a "use server"
 * file may only export async functions, and `INITIAL_CREATE_USER_STATE`
 * below is a plain object.
 */
export interface CreateUserState {
  readonly fieldErrors: CreateUserFieldErrors;
  readonly formError: string | null;
  readonly isSuccess: boolean;
}

export const INITIAL_CREATE_USER_STATE: CreateUserState = {
  fieldErrors: {},
  formError: null,
  isSuccess: false,
};

/**
 * One row of `auth.api.listUsers`'s result, derived from the API itself
 * (via a type-only import — `import type` is erased, so this is not a third
 * Better Auth import site) rather than hand-declared, so it can never drift
 * from what the admin plugin actually returns.
 */
type ListUsersResult = Awaited<ReturnType<typeof auth.api.listUsers>>;
export type AdminUserRowUser = ListUsersResult["users"][number];
