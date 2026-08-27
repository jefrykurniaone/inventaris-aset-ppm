"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/FieldError";
import { FieldLabel } from "@/components/FieldLabel";
import { FormError } from "@/components/FormError";
import { FormRequiredLegend } from "@/components/FormRequiredLegend";
import { SubmitButton } from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import { INITIAL_ROOM_FORM_STATE, type RoomFormState } from "./schemas";

type RoomAction = (
  state: RoomFormState,
  formData: FormData,
) => Promise<RoomFormState>;

interface BuildingOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

interface TextFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue?: string;
  readonly error?: string;
  /** Code and name are both required (issue #105); carried as a prop rather
   * than re-derived so `TextField` stays free of field-name knowledge. */
  readonly isMarkedRequired?: boolean;
}

/** A module-level sibling of `RoomForm`, not defined inside its render
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

interface BuildingFieldProps {
  readonly label: string;
  readonly buildingOptions: readonly BuildingOption[];
  readonly defaultValue?: string;
  readonly error?: string;
  readonly placeholder: string;
}

/** The building picker, required (PRD FR-3.3: "Room creation requires a
 * building") — there is no "no building" option in the list. */
function BuildingField({
  label,
  buildingOptions,
  defaultValue,
  error,
  placeholder,
}: Readonly<BuildingFieldProps>) {
  const errorId = "room-building-error";
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor="room-building" label={label} isMarkedRequired />
      <Select
        id="room-building"
        name="buildingId"
        defaultValue={defaultValue ?? ""}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {buildingOptions.map((building) => (
          <option key={building.id} value={building.id}>
            {`${building.code} — ${building.name}`}
          </option>
        ))}
      </Select>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

interface RoomFormProps {
  readonly action: RoomAction;
  readonly heading: string;
  readonly submitLabel: string;
  readonly submitPendingLabel: string;
  readonly buildingOptions: readonly BuildingOption[];
  readonly buildingLabel: string;
  readonly buildingPlaceholder: string;
  readonly codeLabel: string;
  readonly nameLabel: string;
  readonly id?: string;
  readonly defaultBuildingId?: string;
  readonly defaultCode?: string;
  readonly defaultName?: string;
}

/** Create-and-edit form for `Room` (PRD FR-3.1, FR-3.3), shared between
 * `page.tsx` (create) and `[id]/page.tsx` (edit). */
export function RoomForm({
  action,
  heading,
  submitLabel,
  submitPendingLabel,
  buildingOptions,
  buildingLabel,
  buildingPlaceholder,
  codeLabel,
  nameLabel,
  id,
  defaultBuildingId,
  defaultCode,
  defaultName,
}: Readonly<RoomFormProps>) {
  const [state, formAction] = useActionState(action, INITIAL_ROOM_FORM_STATE);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 sm:max-w-md"
      noValidate
    >
      <h2 className="text-lg font-medium">{heading}</h2>
      {id && <input type="hidden" name="id" value={id} />}
      <FormRequiredLegend />
      <BuildingField
        label={buildingLabel}
        buildingOptions={buildingOptions}
        defaultValue={defaultBuildingId}
        error={state.fieldErrors.buildingId}
        placeholder={buildingPlaceholder}
      />
      <TextField
        id="room-code"
        name="code"
        label={codeLabel}
        defaultValue={defaultCode}
        error={state.fieldErrors.code}
        isMarkedRequired
      />
      <TextField
        id="room-name"
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
