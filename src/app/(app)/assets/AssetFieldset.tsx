"use client";

import { OptionComboboxField } from "@/components/OptionComboboxField";
import { isMarkedRequired } from "@/lib/required-marker";

import type {
  AssetFieldSpec,
  AssetOptionSets,
  AssetSelectFieldSpec,
  AssetsTranslate,
} from "./asset-field-specs";
import {
  assetFieldId,
  AssetSelectField,
  AssetTextAreaField,
  AssetTextField,
} from "./AssetFormFields";
import type {
  AssetFieldErrors,
  AssetFieldName,
  AssetFieldNotes,
  AssetFormDefaults,
} from "./schemas";

/**
 * Renders one described field, and one `<fieldset>` of them.
 *
 * A real `<fieldset>` with a real `<legend>` rather than a `<div>` with a
 * heading: the grouping is then part of the accessibility tree, so a screen
 * reader announces "Procurement and custodian" with each field inside it
 * instead of leaving the reader to infer the grouping from visual order —
 * semantic elements before ARIA roles.
 */

/** What every control below is given regardless of its kind. */
interface SharedFieldProps {
  readonly name: AssetFieldName;
  readonly label: string;
  readonly defaultValue: string;
  readonly error?: string;
  /** Derived once here from the spec, so no control re-decides it and none of
   * them knows a field name (issue #103). */
  readonly isMarkedRequired: boolean;
}

interface AssetSelectControlProps {
  readonly spec: AssetSelectFieldSpec;
  readonly shared: SharedFieldProps;
  readonly t: AssetsTranslate;
  readonly options: AssetOptionSets;
  readonly lockedNote?: string;
}

/**
 * A picker, in one of its two shapes: a searchable combobox for the
 * master-data fields (issue #88) and the native `<select>` for the fixed
 * enumerations. Split out of `AssetField` so that function stays a short
 * dispatch and this one stays under the project's 40-line limit.
 *
 * A locked field is never searchable — `lockedNote` only ever arrives on
 * `status`, which is a fixed enumeration.
 */
function AssetSelectControl({
  spec,
  shared,
  t,
  options,
  lockedNote,
}: Readonly<AssetSelectControlProps>) {
  const placeholder = t(spec.placeholderKey);
  const fieldOptions = options[spec.optionsKey];

  if (spec.isSearchable) {
    return (
      <OptionComboboxField
        {...shared}
        id={assetFieldId(spec.name)}
        isRequired={spec.isRequired}
        placeholder={placeholder}
        options={fieldOptions}
      />
    );
  }

  return (
    <AssetSelectField
      {...shared}
      isRequired={spec.isRequired}
      placeholder={placeholder}
      options={fieldOptions}
      lockedNote={lockedNote}
    />
  );
}

interface AssetFieldProps {
  readonly spec: AssetFieldSpec;
  readonly t: AssetsTranslate;
  readonly defaults: AssetFormDefaults;
  readonly errors: AssetFieldErrors;
  readonly lockedNotes: AssetFieldNotes;
  readonly options: AssetOptionSets;
}

export function AssetField({
  spec,
  t,
  defaults,
  errors,
  lockedNotes,
  options,
}: Readonly<AssetFieldProps>) {
  const shared: SharedFieldProps = {
    name: spec.name,
    label: t(spec.labelKey),
    defaultValue: defaults[spec.name],
    error: errors[spec.name],
    isMarkedRequired: isMarkedRequired(spec),
  };

  if (spec.kind === "select") {
    return (
      <AssetSelectControl
        spec={spec}
        shared={shared}
        t={t}
        options={options}
        lockedNote={lockedNotes[spec.name]}
      />
    );
  }

  if (spec.kind === "textarea") {
    return <AssetTextAreaField {...shared} />;
  }

  return (
    <AssetTextField
      {...shared}
      isRequired={spec.isRequired}
      type={spec.type}
      inputMode={spec.inputMode}
    />
  );
}

interface AssetFieldsetProps {
  readonly legend: string;
  readonly note?: string;
  readonly specs: readonly AssetFieldSpec[];
  readonly t: AssetsTranslate;
  readonly defaults: AssetFormDefaults;
  readonly errors: AssetFieldErrors;
  readonly lockedNotes: AssetFieldNotes;
  readonly options: AssetOptionSets;
}

export function AssetFieldset({
  legend,
  note,
  specs,
  t,
  defaults,
  errors,
  lockedNotes,
  options,
}: Readonly<AssetFieldsetProps>) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-lg font-medium">{legend}</legend>
      {note && <p className="text-muted-foreground text-sm">{note}</p>}
      {specs.map((spec) => (
        <AssetField
          key={spec.name}
          spec={spec}
          t={t}
          defaults={defaults}
          errors={errors}
          lockedNotes={lockedNotes}
          options={options}
        />
      ))}
    </fieldset>
  );
}
