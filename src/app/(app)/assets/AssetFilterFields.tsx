import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

import type { AssetOption } from "./schemas";

/**
 * The two labelled controls the asset list's filter form is built from
 * (PRD FR-2.6), declared at module level rather than inside `AssetFilters`'s
 * render (S6478) so that component's own body stays a short list of calls.
 *
 * Neither carries an inline error: this is a plain `GET` filter form, not a
 * validated write — an unparseable value already fell back to a default in
 * `list-schemas.ts` before either of these ever renders.
 */

interface AssetFilterSelectProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly allLabel: string;
  readonly defaultValue: string;
  readonly options: readonly AssetOption[];
}

export function AssetFilterSelect({
  id,
  name,
  label,
  allLabel,
  defaultValue,
  options,
}: Readonly<AssetFilterSelectProps>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} name={name} defaultValue={defaultValue}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

interface AssetFilterTextInputProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly type?: "text" | "number";
  readonly inputMode?: "numeric" | "search";
}

export function AssetFilterTextInput({
  id,
  name,
  label,
  defaultValue,
  type = "text",
  inputMode,
}: Readonly<AssetFilterTextInputProps>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
      />
    </div>
  );
}
