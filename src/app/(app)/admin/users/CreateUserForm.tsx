"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/FieldError";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { ADMIN_ROLE, STAFF_ROLE } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { createUserAction } from "./actions";
import { INITIAL_CREATE_USER_STATE } from "./schemas";

const SELECT_CLASS = cn(
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
);

/**
 * The three plain text fields, data-driven rather than repeated JSX blocks —
 * `name` doubles as the key into `createUserAction`'s `fieldErrors`, since
 * the schema in `./schemas.ts` uses the same three names.
 */
const TEXT_FIELDS = [
  {
    id: "create-user-name",
    name: "name",
    labelKey: "nameLabel",
    type: "text",
    autoComplete: "name",
  },
  {
    id: "create-user-email",
    name: "email",
    labelKey: "emailLabel",
    type: "email",
    autoComplete: "email",
  },
  {
    id: "create-user-password",
    name: "password",
    labelKey: "passwordLabel",
    type: "password",
    autoComplete: "new-password",
  },
] as const;

interface FormFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly type: string;
  readonly autoComplete: string;
  readonly error?: string;
}

/** One labelled input plus its inline error. A module-level sibling of
 * `CreateUserForm`, not a component nested inside its render — the same
 * pattern `HomePage`'s `ThemeCard` already uses in this codebase. */
function FormField({
  id,
  name,
  label,
  type,
  autoComplete,
  error,
}: Readonly<FormFieldProps>) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
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

/** The role select, split out so `CreateUserForm` stays under the
 * project's 40-line limit. `STAFF_ROLE` is the default per PRD FR-1.3. */
function RoleSelect() {
  const t = useTranslations("AdminUsersPage");

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="create-user-role">{t("roleLabel")}</Label>
      <select
        id="create-user-role"
        name="role"
        defaultValue={STAFF_ROLE}
        className={SELECT_CLASS}
      >
        <option value={STAFF_ROLE}>{t("roleOptionStaff")}</option>
        <option value={ADMIN_ROLE}>{t("roleOptionAdmin")}</option>
      </select>
    </div>
  );
}

/**
 * The admin-only "create user" form (PRD FR-1.3). `createUserAction` is a
 * real Server Action — `requireAdmin()` runs inside it regardless of what
 * this form does — so this component's only job is presentation: inline
 * field errors, a form-level error, and a disabled-while-pending submit.
 */
export function CreateUserForm() {
  const t = useTranslations("AdminUsersPage");
  const [state, formAction] = useActionState(
    createUserAction,
    INITIAL_CREATE_USER_STATE,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 sm:max-w-md"
      noValidate
    >
      <h2 className="text-lg font-medium">{t("createHeading")}</h2>
      {TEXT_FIELDS.map((field) => (
        <FormField
          key={field.name}
          id={field.id}
          name={field.name}
          label={t(field.labelKey)}
          type={field.type}
          autoComplete={field.autoComplete}
          error={state.fieldErrors[field.name]}
        />
      ))}
      <RoleSelect />
      <FormError message={state.formError} />
      <SubmitButton
        idleLabel={t("createSubmit")}
        pendingLabel={t("createSubmitPending")}
      />
    </form>
  );
}
