"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/FieldError";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  INITIAL_LOAN_FORM_STATE,
  type CheckOutFieldName,
  type LoanFormState,
} from "./schemas";

/**
 * The check-out form (PRD FR-6.1): borrower name, email and unit, a due date,
 * and optional notes.
 *
 * A Client Component only because it renders per-field validation messages
 * through `useActionState`. Every label it shows arrives as a plain string from
 * the Server Component that mounts it — a translator function cannot cross the
 * boundary, and passing one field's worth of props per field would make this
 * component's signature longer than its body.
 *
 * The due-date rule is not enforced here. `<input type="date">` has a `min`
 * attribute that would look like enforcement and is not one — it is trivially
 * bypassed, and computing "today" in the browser at render risks a hydration
 * mismatch against the server's own clock. The rule lives in `refuseCheckOut`,
 * server-side, and its refusal comes back as this field's error.
 */

export type CheckOutAction = (
  state: LoanFormState,
  formData: FormData,
) => Promise<LoanFormState>;

export interface CheckOutFormLabels {
  readonly heading: string;
  readonly intro: string;
  readonly borrowerName: string;
  readonly borrowerEmail: string;
  readonly borrowerUnit: string;
  readonly dueAt: string;
  readonly notes: string;
  readonly submit: string;
  readonly submitPending: string;
}

interface CheckOutTextFieldSpec {
  readonly name: Exclude<CheckOutFieldName, "notes">;
  readonly type: "text" | "email" | "date";
}

/** The four required fields, as data rather than four near-identical blocks. */
const TEXT_FIELD_SPECS: readonly CheckOutTextFieldSpec[] = [
  { name: "borrowerName", type: "text" },
  { name: "borrowerEmail", type: "email" },
  { name: "borrowerUnit", type: "text" },
  { name: "dueAt", type: "date" },
];

interface LoanTextFieldProps {
  readonly name: string;
  readonly type: string;
  readonly label: string;
  readonly error?: string;
}

/** A module-level sibling of `CheckOutForm`, never defined inside its render
 * (S6478) — the same shape `BuildingForm`'s `TextField` takes. */
function LoanTextField({
  name,
  type,
  label,
  error,
}: Readonly<LoanTextFieldProps>) {
  const id = `check-out-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function LoanNotesField({
  label,
  error,
}: Readonly<{ label: string; error?: string }>) {
  const errorId = "check-out-notes-error";
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="check-out-notes">{label}</Label>
      <Textarea
        id="check-out-notes"
        name="notes"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

interface CheckOutFormProps {
  readonly action: CheckOutAction;
  readonly assetId: string;
  readonly labels: CheckOutFormLabels;
}

export function CheckOutForm({
  action,
  assetId,
  labels,
}: Readonly<CheckOutFormProps>) {
  const [state, formAction] = useActionState(action, INITIAL_LOAN_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <h3 className="font-medium">{labels.heading}</h3>
      <p className="text-muted-foreground text-sm">{labels.intro}</p>
      <input type="hidden" name="assetId" value={assetId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TEXT_FIELD_SPECS.map((spec) => (
          <LoanTextField
            key={spec.name}
            name={spec.name}
            type={spec.type}
            label={labels[spec.name]}
            error={state.fieldErrors[spec.name]}
          />
        ))}
      </div>
      <LoanNotesField label={labels.notes} error={state.fieldErrors.notes} />
      <FormError message={state.formError} />
      <div>
        <SubmitButton
          idleLabel={labels.submit}
          pendingLabel={labels.submitPending}
        />
      </div>
    </form>
  );
}
