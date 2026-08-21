"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/require-user";

import {
  createUserSchema,
  type CreateUserState,
  userIdSchema,
} from "./schemas";

const USERS_PATH = "/admin/users";

/**
 * Duck-types a Better Auth `APIError`'s `{ code, message }` body rather than
 * importing `isAPIError`/`APIError` from the `better-auth` package: this
 * file is not one of the project's two allowed Better Auth import sites
 * (`src/lib/auth.ts`, `src/lib/auth-client.ts`), so it only ever touches the
 * library through the already-configured `auth` object. Mirrors the same
 * duck-typing `scripts/verify-application-schema.ts` uses for Prisma errors.
 */
function readErrorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object" || !("body" in error)) {
    return undefined;
  }
  const { body } = error as { body?: unknown };
  if (body === null || typeof body !== "object" || !("code" in body)) {
    return undefined;
  }
  const { code } = body as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

function logActionError(action: string, input: unknown, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `admin/users/actions.${action}: input=${JSON.stringify(input)} — ${message}`,
  );
}

const USER_ALREADY_EXISTS_CODES = new Set([
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  "USER_ALREADY_EXISTS",
]);

type Translate = Awaited<ReturnType<typeof getTranslations<"AdminUsersPage">>>;

type CreateUserFieldName = keyof CreateUserState["fieldErrors"];

/** One message key per field, looked up rather than branched on (S121: a
 * chain of bare `if (...) x;` statements is exactly the shape Sonar flags,
 * and a lookup reads better besides). */
const FIELD_ERROR_KEYS: Record<CreateUserFieldName, Parameters<Translate>[0]> =
  {
    name: "nameRequired",
    email: "emailInvalid",
    password: "passwordTooShort",
  };

function isCreateUserFieldName(
  value: PropertyKey,
): value is CreateUserFieldName {
  return value === "name" || value === "email" || value === "password";
}

/** Maps zod's issue paths to this form's three fields, each with its own
 * localised message — kept separate from `createUserAction` so that
 * function stays inside the project's 40-line limit. */
function buildCreateUserFieldErrors(
  t: Translate,
  issues: ReadonlyArray<{ path: PropertyKey[] }>,
): CreateUserState["fieldErrors"] {
  const fieldErrors: CreateUserState["fieldErrors"] = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isCreateUserFieldName(field)) {
      fieldErrors[field] = t(FIELD_ERROR_KEYS[field]);
    }
  }
  return fieldErrors;
}

/**
 * Creates a user with a role, using the Better Auth `admin()` plugin
 * (PRD FR-1.3) rather than a hand-rolled equivalent. `requireAdmin()` is the
 * first statement — a staff caller is redirected before the form data is
 * even parsed, let alone before `auth.api.createUser` is reached. This is
 * also the boundary the "calls the action directly" acceptance test targets.
 */
export async function createUserAction(
  _previousState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  await requireAdmin();

  const t = await getTranslations("AdminUsersPage");
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: buildCreateUserFieldErrors(t, parsed.error.issues),
      formError: null,
      isSuccess: false,
    };
  }

  try {
    await auth.api.createUser({
      body: parsed.data,
      headers: await headers(),
    });
  } catch (error) {
    logActionError("createUserAction", { email: parsed.data.email }, error);
    const code = readErrorCode(error);
    const formError = USER_ALREADY_EXISTS_CODES.has(code ?? "")
      ? t("userAlreadyExists")
      : t("unexpectedError");
    return { fieldErrors: {}, formError, isSuccess: false };
  }

  revalidatePath(USERS_PATH);
  return { fieldErrors: {}, formError: null, isSuccess: true };
}

/**
 * Deactivates a user (PRD FR-1.3) via the admin plugin's ban, per this
 * project's constraint that deactivation is not a new schema column. A
 * plain form action with no return value: the row's own "deactivate" button
 * is hidden for the signed-in admin's own account as a UX nicety, and
 * Better Auth's own `YOU_CANNOT_BAN_YOURSELF` check backs that up
 * server-side regardless — a failure here is logged and the row simply
 * stays as it was, rather than the mutation being silently accepted.
 */
export async function deactivateUserAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = userIdSchema.parse(formData.get("userId"));

  try {
    await auth.api.banUser({ body: { userId }, headers: await headers() });
  } catch (error) {
    logActionError("deactivateUserAction", { userId }, error);
    return;
  }

  revalidatePath(USERS_PATH);
}

/** The reciprocal of `deactivateUserAction`, so deactivating is not one-way. */
export async function reactivateUserAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = userIdSchema.parse(formData.get("userId"));

  try {
    await auth.api.unbanUser({ body: { userId }, headers: await headers() });
  } catch (error) {
    logActionError("reactivateUserAction", { userId }, error);
    return;
  }

  revalidatePath(USERS_PATH);
}
