"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/FieldError";
import { FieldLabel } from "@/components/FieldLabel";
import { FormError } from "@/components/FormError";
import { FormRequiredLegend } from "@/components/FormRequiredLegend";
import { SubmitButton } from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";

import {
  INITIAL_FUNDING_SOURCE_FORM_STATE,
  type FundingSourceFormState,
} from "./schemas";

type FundingSourceAction = (
  state: FundingSourceFormState,
  formData: FormData,
) => Promise<FundingSourceFormState>;

interface FieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue?: string | null;
  readonly error?: string;
  readonly required?: boolean;
  /** Only `name` is required (issue #105); `notes` stays unmarked. Kept
   * separate from `required` since the marker never changes `required` /
   * `aria-required` on the control. */
  readonly isMarkedRequired?: boolean;
}

/** A module-level sibling of `FundingSourceForm`, not defined inside its
 * render (S6478) — mirrors `CreateUserForm`'s `FormField`. */
function Field({
  id,
  name,
  label,
  defaultValue,
  error,
  required = false,
  isMarkedRequired,
}: Readonly<FieldProps>) {
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
        defaultValue={defaultValue ?? ""}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

interface FundingSourceFormProps {
  readonly action: FundingSourceAction;
  readonly heading: string;
  readonly submitLabel: string;
  readonly submitPendingLabel: string;
  readonly nameLabel: string;
  readonly notesLabel: string;
  readonly id?: string;
  readonly defaultName?: string;
  readonly defaultNotes?: string | null;
}

/** Create-and-edit form for `FundingSource` (PRD FR-3.1), shared between
 * `page.tsx` (create) and `[id]/page.tsx` (edit). */
export function FundingSourceForm({
  action,
  heading,
  submitLabel,
  submitPendingLabel,
  nameLabel,
  notesLabel,
  id,
  defaultName,
  defaultNotes,
}: Readonly<FundingSourceFormProps>) {
  const [state, formAction] = useActionState(
    action,
    INITIAL_FUNDING_SOURCE_FORM_STATE,
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
      <Field
        id="funding-source-name"
        name="name"
        label={nameLabel}
        defaultValue={defaultName}
        error={state.fieldErrors.name}
        required
        isMarkedRequired
      />
      <Field
        id="funding-source-notes"
        name="notes"
        label={notesLabel}
        defaultValue={defaultNotes}
        error={state.fieldErrors.notes}
      />
      <FormError message={state.formError} />
      <SubmitButton idleLabel={submitLabel} pendingLabel={submitPendingLabel} />
    </form>
  );
}
