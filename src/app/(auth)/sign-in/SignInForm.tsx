"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/FieldError";
import { FieldLabel } from "@/components/FieldLabel";
import { FormError } from "@/components/FormError";
import { FormRequiredLegend } from "@/components/FormRequiredLegend";
import { authClient } from "@/lib/auth-client";
import { HOME_PATH } from "@/lib/paths";

import { signInSchema } from "./sign-in-schema";

interface SignInFieldErrors {
  email?: string;
  password?: string;
}

interface SignInFormState {
  readonly fieldErrors: SignInFieldErrors;
  readonly formError: string | null;
  readonly isSuccess: boolean;
}

const INITIAL_STATE: SignInFormState = {
  fieldErrors: {},
  formError: null,
  isSuccess: false,
};

/** HTTP status Better Auth's `/sign-in/email` returns for any credential
 * failure — unknown email and wrong password alike (see the module doc
 * below). Any other error is shown as a generic, localised failure rather
 * than guessed at. */
const INVALID_CREDENTIALS_STATUS = 401;

type Translate = ReturnType<typeof useTranslations<"SignInForm">>;

/** Maps zod's issue paths to this form's two fields. A module-level
 * function, not one nested inside `SignInForm`, so that component stays
 * under the project's 40-line limit. */
function buildValidationErrorState(
  issues: ReadonlyArray<{ path: PropertyKey[] }>,
  t: Translate,
): SignInFormState {
  const fieldErrors: SignInFieldErrors = {};
  for (const issue of issues) {
    if (issue.path[0] === "email") {
      fieldErrors.email = t("emailInvalid");
    }
    if (issue.path[0] === "password") {
      fieldErrors.password = t("passwordRequired");
    }
  }
  return { fieldErrors, formError: null, isSuccess: false };
}

/** Every credential failure gets the identical message — an unknown email
 * and a wrong password are indistinguishable at the source, since Better
 * Auth's `/sign-in/email` returns the same status and code for both, to
 * prevent enumerating registered emails. Anything else is a generic
 * failure rather than a guessed-at specific one. */
function resolveCredentialsErrorMessage(
  status: number | undefined,
  t: Translate,
): string {
  return status === INVALID_CREDENTIALS_STATUS
    ? t("invalidCredentials")
    : t("unexpectedError");
}

/**
 * Reads a text field out of a `FormData`.
 *
 * `String(formData.get(name) ?? "")` is the shorter way to write this and it
 * is wrong: `get` returns `string | File | null`, and a `File` stringifies to
 * `[object File]` — which would then be handed to `signInSchema` as though it
 * were a credential (SonarQube `typescript:S6551`). An entry that is not a
 * string is not a text field, so it reads as absent and the schema rejects it
 * for being empty, which is what it is.
 */
function readTextField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Validates, then calls `authClient.signIn.email` directly — there is no
 * server action of this project's own here, because the authoritative
 * validation for this request already lives inside Better Auth's own
 * `/sign-in/email` route (see `src/app/(auth)/sign-in/sign-in-schema.ts`).
 * A module-level function so `SignInForm` only has to call it, not contain
 * it.
 */
async function resolveSignInState(
  formData: FormData,
  t: Translate,
): Promise<SignInFormState> {
  const email = readTextField(formData, "email");
  const password = readTextField(formData, "password");

  const parsed = signInSchema.safeParse({ email, password });
  if (!parsed.success) {
    return buildValidationErrorState(parsed.error.issues, t);
  }

  const { error } = await authClient.signIn.email(parsed.data);
  if (error) {
    return {
      fieldErrors: {},
      formError: resolveCredentialsErrorMessage(error.status, t),
      isSuccess: false,
    };
  }

  return { fieldErrors: {}, formError: null, isSuccess: true };
}

/** The form's two fields, data-driven rather than repeated JSX blocks —
 * mirrors `CreateUserForm`'s `TEXT_FIELDS`. */
const FIELDS = [
  {
    id: "sign-in-email",
    name: "email",
    type: "email",
    autoComplete: "email",
    labelKey: "emailLabel",
  },
  {
    id: "sign-in-password",
    name: "password",
    type: "password",
    autoComplete: "current-password",
    labelKey: "passwordLabel",
  },
] as const;

interface SignInFieldProps {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly autoComplete: string;
  readonly label: string;
  readonly error?: string;
}

/** One labelled input plus its inline, `aria-describedby`-linked error. Both
 * fields are always required, so the marker is passed directly rather than
 * derived (issue #104). */
function SignInField({
  id,
  name,
  type,
  autoComplete,
  label,
  error,
}: Readonly<SignInFieldProps>) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} label={label} isMarkedRequired />
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

/**
 * The sign-in form itself (PRD FR-1.1): inline validation, a submit
 * disabled while pending, and a redirect home on success — followed by
 * `router.refresh()` so a previous account's Router Cache entries for the
 * home route do not get served to the freshly signed-in account. Everything
 * that is not presentation lives in `resolveSignInState` above.
 */
export function SignInForm() {
  const t = useTranslations("SignInForm");
  const router = useRouter();

  async function signIn(
    _previousState: SignInFormState,
    formData: FormData,
  ): Promise<SignInFormState> {
    const nextState = await resolveSignInState(formData, t);
    if (nextState.isSuccess) {
      router.push(HOME_PATH);
      // Refresh queues behind the pending push in Next's router action
      // queue, so it runs against the destination route: it re-fetches the
      // root layout and page from the server, replacing the Router Cache
      // entries that still hold the previous account's session-derived
      // name, menu, and dashboard data. Calling it before push would get it
      // discarded instead, since a navigate action preempts a pending
      // refresh.
      router.refresh();
    }
    return nextState;
  }

  const [state, formAction, isPending] = useActionState(signIn, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {/* Once per form, above the fields — the first form anyone meets, so
          this is where the app-wide required-field convention is taught
          (issue #104). */}
      <FormRequiredLegend />
      {FIELDS.map((field) => (
        <SignInField
          key={field.name}
          id={field.id}
          name={field.name}
          type={field.type}
          autoComplete={field.autoComplete}
          label={t(field.labelKey)}
          error={state.fieldErrors[field.name]}
        />
      ))}
      <FormError message={state.formError} />
      <Button type="submit" disabled={isPending} aria-busy={isPending}>
        {isPending ? t("submitPending") : t("submit")}
      </Button>
    </form>
  );
}
