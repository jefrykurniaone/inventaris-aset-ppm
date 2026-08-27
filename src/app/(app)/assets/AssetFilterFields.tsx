import { OptionComboboxField } from "@/components/OptionComboboxField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

import type { AssetsTranslate } from "./asset-field-specs";
import type { AssetFilterSelectSpec } from "./asset-filter-specs";
import type { AssetOption } from "./schemas";

/**
 * The labelled controls the asset list's filter form is built from
 * (PRD FR-2.6), declared at module level rather than inside `AssetFilters`'s
 * render (S6478) so that component's own body stays a short list of calls.
 *
 * None carries an inline error: this is a plain `GET` filter form, not a
 * validated write — an unparseable value already fell back to a default in
 * `list-schemas.ts` before any of these ever renders.
 */

/** The id every filter control answers to, so the label and the control agree
 * on one spelling. */
function filterFieldId(name: string): string {
  return `asset-list-${name}`;
}

interface AssetFilterControlProps {
  readonly spec: AssetFilterSelectSpec;
  readonly defaultValue: string;
  readonly options: readonly AssetOption[];
  readonly t: AssetsTranslate;
}

/**
 * One filter, in whichever shape its spec asks for: a searchable combobox for
 * categories and rooms (issue #88), the native `<select>` for the rest.
 *
 * Both submit the same way. The combobox is not a `<select>`, so it carries
 * the chosen id in a hidden input under the same `name` — the filter form
 * stays a plain `GET` round-trip and its query string is byte-for-byte the one
 * the native select produced. "No choice" is the empty string in both, which
 * `list-schemas.ts` already reads as "all".
 */
export function AssetFilterControl({
  spec,
  defaultValue,
  options,
  t,
}: Readonly<AssetFilterControlProps>) {
  const id = filterFieldId(spec.name);
  const label = t(spec.labelKey);
  const allLabel = t(spec.allLabelKey);

  if (spec.isSearchable) {
    return (
      <OptionComboboxField
        id={id}
        name={spec.name}
        label={label}
        placeholder={allLabel}
        options={options}
        defaultValue={defaultValue}
      />
    );
  }

  return (
    <AssetFilterSelect
      id={id}
      name={spec.name}
      label={label}
      allLabel={allLabel}
      defaultValue={defaultValue}
      options={options}
    />
  );
}

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
