"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/FieldError";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { INITIAL_BUILDING_FORM_STATE, type BuildingFormState } from "./schemas";

type BuildingAction = (
  state: BuildingFormState,
  formData: FormData,
) => Promise<BuildingFormState>;

interface TextFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue?: string;
  readonly error?: string;
}

/** A module-level sibling of `BuildingForm`, not defined inside its render
 * (S6478) — mirrors `CreateUserForm`'s `FormField`. */
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

interface BuildingFormProps {
  readonly action: BuildingAction;
  readonly heading: string;
  readonly submitLabel: string;
  readonly submitPendingLabel: string;
  readonly id?: string;
  readonly defaultCode?: string;
  readonly defaultName?: string;
  readonly codeLabel: string;
  readonly nameLabel: string;
}

/** Create-and-edit form for `Building` (PRD FR-3.1, FR-3.3), shared between
 * `page.tsx` (create) and `[id]/page.tsx` (edit). */
export function BuildingForm({
  action,
  heading,
  submitLabel,
  submitPendingLabel,
  id,
  defaultCode,
  defaultName,
  codeLabel,
  nameLabel,
}: Readonly<BuildingFormProps>) {
  const [state, formAction] = useActionState(
    action,
    INITIAL_BUILDING_FORM_STATE,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 sm:max-w-md"
      noValidate
    >
      <h2 className="text-lg font-medium">{heading}</h2>
      {id && <input type="hidden" name="id" value={id} />}
      <TextField
        id="building-code"
        name="code"
        label={codeLabel}
        defaultValue={defaultCode}
        error={state.fieldErrors.code}
      />
      <TextField
        id="building-name"
        name="name"
        label={nameLabel}
        defaultValue={defaultName}
        error={state.fieldErrors.name}
      />
      <FormError message={state.formError} />
      <SubmitButton idleLabel={submitLabel} pendingLabel={submitPendingLabel} />
    </form>
  );
}
