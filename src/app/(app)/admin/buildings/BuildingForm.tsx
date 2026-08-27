"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/FieldError";
import { FieldLabel } from "@/components/FieldLabel";
import { FormError } from "@/components/FormError";
import { FormRequiredLegend } from "@/components/FormRequiredLegend";
import { SubmitButton } from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";

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
  /** Both of this form's fields are required (issue #105); carried as a prop
   * rather than re-derived so `TextField` stays free of field-name knowledge. */
  readonly isMarkedRequired?: boolean;
}

/** A module-level sibling of `BuildingForm`, not defined inside its render
 * (S6478) — mirrors `CreateUserForm`'s `FormField`. */
function TextField({
  id,
  name,
  label,
  defaultValue,
  error,
  isMarkedRequired,
}: Readonly<TextFieldProps>) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel
        htmlFor={id}
        label={label}
        isMarkedRequired={isMarkedRequired}
      />
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
      <FormRequiredLegend />
      <TextField
        id="building-code"
        name="code"
        label={codeLabel}
        defaultValue={defaultCode}
        error={state.fieldErrors.code}
        isMarkedRequired
      />
      <TextField
        id="building-name"
        name="name"
        label={nameLabel}
        defaultValue={defaultName}
        error={state.fieldErrors.name}
        isMarkedRequired
      />
      <FormError message={state.formError} />
      <SubmitButton idleLabel={submitLabel} pendingLabel={submitPendingLabel} />
    </form>
  );
}
