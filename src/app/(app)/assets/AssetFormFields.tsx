"use client";

import { FieldError } from "@/components/FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { AssetFieldName, AssetOption } from "./schemas";

/**
 * The three labelled controls the asset form is built from, declared at
 * module level rather than inside `AssetForm`'s render (S6478).
 *
 * Every one carries a real `<label htmlFor>` — not a placeholder standing in
 * for one — and links its inline error through `aria-describedby`, so the
 * error is announced with the field rather than only seen next to it.
 */

/** Exported because the searchable combobox in `AssetFieldset` stands in for
 * one of these controls and has to answer to the same id — the id its
 * `<label htmlFor>` and the end-to-end specs both go through. */
export function assetFieldId(name: AssetFieldName): string {
  return `asset-${name}`;
}

interface AssetTextFieldProps {
  readonly name: AssetFieldName;
  readonly label: string;
  readonly defaultValue: string;
  readonly error?: string;
  readonly isRequired?: boolean;
  readonly type?: "text" | "email" | "date" | "number";
  readonly inputMode?: "numeric" | "decimal";
}

export function AssetTextField({
  name,
  label,
  defaultValue,
  error,
  isRequired = false,
  type = "text",
  inputMode,
}: Readonly<AssetTextFieldProps>) {
  const id = assetFieldId(name);
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        required={isRequired}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

interface AssetSelectFieldProps {
  readonly name: AssetFieldName;
  readonly label: string;
  readonly defaultValue: string;
  readonly error?: string;
  readonly isRequired?: boolean;
  readonly placeholder: string;
  readonly options: readonly AssetOption[];
  readonly lockedNote?: string;
}

function describedBy(ids: readonly (string | null)[]): string | undefined {
  const present = ids.filter((id): id is string => id !== null);
  return present.length > 0 ? present.join(" ") : undefined;
}

/**
 * A picker. When the field is required the placeholder row is `disabled`, so
 * it can be read but never chosen; when it is optional the same row stays
 * selectable and means "none" — a funding source is genuinely optional
 * (§8.2), and an explicit "none" beats leaving the first record silently
 * pre-selected.
 *
 * A `lockedNote` renders the control disabled with its note underneath — the
 * `status` picker on an asset that is out on loan. The disabled `<select>`
 * then carries no `name`, because a disabled control submits nothing and the
 * server would read a required field as missing; the value travels in the
 * hidden input beside it instead. None of this is authorisation:
 * `refuseStatusTransition` in `schemas.ts` is what actually refuses, on the
 * server, whatever the client submits.
 */
export function AssetSelectField({
  name,
  label,
  defaultValue,
  error,
  isRequired = false,
  placeholder,
  options,
  lockedNote,
}: Readonly<AssetSelectFieldProps>) {
  const id = assetFieldId(name);
  const errorId = `${id}-error`;
  const noteId = `${id}-note`;
  const isLocked = lockedNote !== undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {isLocked && <input type="hidden" name={name} value={defaultValue} />}
      <Select
        id={id}
        name={isLocked ? undefined : name}
        defaultValue={defaultValue}
        required={isRequired && !isLocked}
        disabled={isLocked}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy([
          error ? errorId : null,
          isLocked ? noteId : null,
        ])}
      >
        {!isLocked && (
          <option value="" disabled={isRequired}>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
      {isLocked && (
        <p id={noteId} className="text-muted-foreground text-sm">
          {lockedNote}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

interface AssetTextAreaFieldProps {
  readonly name: AssetFieldName;
  readonly label: string;
  readonly defaultValue: string;
  readonly error?: string;
}

export function AssetTextAreaField({
  name,
  label,
  defaultValue,
  error,
}: Readonly<AssetTextAreaFieldProps>) {
  const id = assetFieldId(name);
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}
