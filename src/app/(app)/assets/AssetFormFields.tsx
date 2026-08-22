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

function fieldId(name: AssetFieldName): string {
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
  const id = fieldId(name);
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
}

/**
 * A picker. When the field is required the placeholder row is `disabled`, so
 * it can be read but never chosen; when it is optional the same row stays
 * selectable and means "none" — a funding source is genuinely optional
 * (§8.2), and an explicit "none" beats leaving the first record silently
 * pre-selected.
 */
export function AssetSelectField({
  name,
  label,
  defaultValue,
  error,
  isRequired = false,
  placeholder,
  options,
}: Readonly<AssetSelectFieldProps>) {
  const id = fieldId(name);
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={isRequired}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      >
        <option value="" disabled={isRequired}>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
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
  const id = fieldId(name);
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
