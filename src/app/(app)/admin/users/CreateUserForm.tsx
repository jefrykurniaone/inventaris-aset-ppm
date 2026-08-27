"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/FieldError";
import { FieldLabel } from "@/components/FieldLabel";
import { FormError } from "@/components/FormError";
import { FormRequiredLegend } from "@/components/FormRequiredLegend";
import { SubmitButton } from "@/components/SubmitButton";
import { ADMIN_ROLE, STAFF_ROLE } from "@/lib/roles";
import { isMarkedRequired } from "@/lib/required-marker";
import type { RequiredMarkerFieldSpec } from "@/lib/required-marker";
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
    isRequired: true,
  },
  {
    id: "create-user-email",
    name: "email",
    labelKey: "emailLabel",
    type: "email",
    autoComplete: "email",
    isRequired: true,
  },
  {
    id: "create-user-password",
    name: "password",
    labelKey: "passwordLabel",
    type: "password",
    autoComplete: "new-password",
    isRequired: true,
  },
] as const;

interface FormFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly type: string;
  readonly autoComplete: string;
  readonly isMarkedRequired?: boolean;
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
  isMarkedRequired: isFieldMarkedRequired,
  error,
}: Readonly<FormFieldProps>) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel
        htmlFor={id}
        label={label}
        isMarkedRequired={isFieldMarkedRequired}
      />
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
 * The role select's own field spec: schema-required, but pre-filled with
 * `STAFF_ROLE` below, so it can never reach the server empty (the same
 * exemption `asset-field-specs.ts`'s `status` field carries) — carried here
 * as data rather than a name check inside `RequiredMarker` or `FieldLabel`.
 */
const ROLE_FIELD_SPEC: RequiredMarkerFieldSpec = {
  isRequired: true,
  hasPrefilledDefault: true,
};

/** The role select, split out so `CreateUserForm` stays under the
 * project's 40-line limit. `STAFF_ROLE` is the default per PRD FR-1.3. */
function RoleSelect() {
  const t = useTranslations("AdminUsersPage");

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel
        htmlFor="create-user-role"
        label={t("roleLabel")}
        isMarkedRequired={isMarkedRequired(ROLE_FIELD_SPEC)}
      />
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
      <FormRequiredLegend />
      {TEXT_FIELDS.map((field) => (
        <FormField
          key={field.name}
          id={field.id}
          name={field.name}
          label={t(field.labelKey)}
          type={field.type}
          autoComplete={field.autoComplete}
          isMarkedRequired={isMarkedRequired(field)}
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
