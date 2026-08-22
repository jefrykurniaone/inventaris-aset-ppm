"use client";

import type {
  AssetFieldSpec,
  AssetOptionSets,
  AssetsTranslate,
} from "./asset-field-specs";
import {
  AssetSelectField,
  AssetTextAreaField,
  AssetTextField,
} from "./AssetFormFields";
import type {
  AssetFieldErrors,
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
  const shared = {
    name: spec.name,
    label: t(spec.labelKey),
    defaultValue: defaults[spec.name],
    error: errors[spec.name],
  };

  if (spec.kind === "select") {
    return (
      <AssetSelectField
        {...shared}
        isRequired={spec.isRequired}
        placeholder={t(spec.placeholderKey)}
        options={options[spec.optionsKey]}
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
