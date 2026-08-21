"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/FieldError";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { INITIAL_CATEGORY_FORM_STATE, type CategoryFormState } from "./schemas";

type CategoryAction = (
  state: CategoryFormState,
  formData: FormData,
) => Promise<CategoryFormState>;

interface TextFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue?: string;
  readonly error?: string;
}

/** One labelled text input plus its inline error, a module-level sibling of
 * `CategoryForm` — not defined inside its render (S6478) — mirroring
 * `CreateUserForm`'s `FormField`. */
function TextField({
  id,
  name,
  label,
  defaultValue,
  error,
}: Readonly<TextFieldProps>) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

interface CodeFieldProps {
  readonly label: string;
  readonly defaultValue?: string;
  readonly error?: string;
  readonly isLocked: boolean;
  readonly lockedNotice?: string;
}

/** The `code` field, split out because it carries the extra
 * referenced-so-locked notice the other two fields never need. */
function CodeField({
  label,
  defaultValue,
  error,
  isLocked,
  lockedNotice,
}: Readonly<CodeFieldProps>) {
  const errorId = "category-code-error";
  const noticeId = "category-code-notice";
  const describedBy = [
    error ? errorId : null,
    isLocked && lockedNotice ? noticeId : null,
  ]
    .filter((value): value is string => value !== null)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="category-code">{label}</Label>
      <Input
        id="category-code"
        name="code"
        defaultValue={defaultValue}
        disabled={isLocked}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
      />
      {isLocked && lockedNotice && (
        <p id={noticeId} className="text-muted-foreground text-sm">
          {lockedNotice}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

interface CategoryFormProps {
  readonly action: CategoryAction;
  readonly heading: string;
  readonly submitLabel: string;
  readonly submitPendingLabel: string;
  readonly id?: string;
  readonly defaultCode?: string;
  readonly defaultName?: string;
  readonly defaultNameEn?: string;
  readonly isCodeLocked?: boolean;
  readonly codeLockedNotice?: string;
  readonly codeLabel: string;
  readonly nameLabel: string;
  readonly nameEnLabel: string;
}

/**
 * Create-and-edit form for `Category` (PRD FR-3.1, FR-3.2), shared between
 * `page.tsx` (create) and `[id]/page.tsx` (edit) via the `action` and
 * `id`/`defaultXxx` props, the same way `admin/users`'s `CreateUserForm`
 * drives its single server action.
 */
export function CategoryForm({
  action,
  heading,
  submitLabel,
  submitPendingLabel,
  id,
  defaultCode,
  defaultName,
  defaultNameEn,
  isCodeLocked = false,
  codeLockedNotice,
  codeLabel,
  nameLabel,
  nameEnLabel,
}: Readonly<CategoryFormProps>) {
  const [state, formAction] = useActionState(
    action,
    INITIAL_CATEGORY_FORM_STATE,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 sm:max-w-md"
      noValidate
    >
      <h2 className="text-lg font-medium">{heading}</h2>
      {id && <input type="hidden" name="id" value={id} />}
      <CodeField
        label={codeLabel}
        defaultValue={defaultCode}
        error={state.fieldErrors.code}
        isLocked={isCodeLocked}
        lockedNotice={codeLockedNotice}
      />
      <TextField
        id="category-name"
        name="name"
        label={nameLabel}
        defaultValue={defaultName}
        error={state.fieldErrors.name}
      />
      <TextField
        id="category-name-en"
        name="nameEn"
        label={nameEnLabel}
        defaultValue={defaultNameEn}
        error={state.fieldErrors.nameEn}
      />
      <FormError message={state.formError} />
      <SubmitButton idleLabel={submitLabel} pendingLabel={submitPendingLabel} />
    </form>
  );
}
