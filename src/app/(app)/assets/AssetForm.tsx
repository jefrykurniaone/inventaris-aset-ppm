"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";

import {
  ASSET_DETAIL_FIELD_SPECS,
  ASSET_PROCUREMENT_FIELD_SPECS,
  CONDITION_LABEL_KEYS,
  STATUS_LABEL_KEYS,
  type AssetOptionSets,
  type AssetsPlainMessageKey,
  type AssetsTranslate,
} from "./asset-field-specs";
import { AssetFieldset } from "./AssetFieldset";
import {
  ASSET_CONDITIONS,
  ASSET_STATUSES,
  EMPTY_ASSET_FORM_DEFAULTS,
  INITIAL_ASSET_FORM_STATE,
  type AssetFormDefaults,
  type AssetFormOptions,
  type AssetFormState,
  type AssetOption,
} from "./schemas";

type AssetAction = (
  state: AssetFormState,
  formData: FormData,
) => Promise<AssetFormState>;

function enumOptions<Value extends string>(
  values: readonly Value[],
  labelKeys: Record<Value, AssetsPlainMessageKey>,
  t: AssetsTranslate,
): readonly AssetOption[] {
  return values.map((value) => {
    // Annotated rather than inlined: inside a generic function
    // `labelKeys[value]` stays a deferred indexed-access type, and next-intl's
    // `t` then cannot tell that none of these keys interpolates a value, so it
    // demands an ICU argument that does not exist.
    const labelKey: AssetsPlainMessageKey = labelKeys[value];
    return { id: value, label: t(labelKey) };
  });
}

interface AssetCodeNoticeProps {
  readonly assetCode: string;
  readonly t: AssetsTranslate;
}

/**
 * The issued code, shown but never submitted.
 *
 * `assetCode` is generated once and never regenerated — not when the category
 * changes, not when the acquisition year is corrected. The label carrying it
 * is already glued to the item, and FR-2.2's promise that the identifier is
 * "stable across renumbering" is worth nothing if an edit form can renumber
 * it. It is rendered as read-only text rather than as a disabled input so
 * that nothing suggests it is a field awaiting a value.
 */
function AssetCodeNotice({ assetCode, t }: Readonly<AssetCodeNoticeProps>) {
  return (
    <div className="border-border flex flex-col gap-1 border-l-2 pl-3">
      <span className="text-muted-foreground text-sm">
        {t("assetCodeLabel")}
      </span>
      <span className="font-mono text-base">{assetCode}</span>
      <span className="text-muted-foreground text-sm">
        {t("assetCodeImmutableNotice")}
      </span>
    </div>
  );
}

interface AssetFormProps {
  readonly action: AssetAction;
  readonly submitLabel: string;
  readonly submitPendingLabel: string;
  readonly options: AssetFormOptions;
  readonly assetId?: string;
  readonly assetCode?: string;
  readonly defaults?: AssetFormDefaults;
}

/**
 * Create-and-edit form for `Asset` (PRD FR-2.1 to FR-2.4), shared between
 * `new/page.tsx` and `[id]/edit/page.tsx` through the `action` and the
 * `assetId`/`defaults` props — the same shape the master-data forms use.
 *
 * `noValidate` turns off the browser's own bubbles so that every message the
 * user reads comes from the message catalogue, and every rejection is the
 * server's: the schema in `schemas.ts` runs again inside the server action,
 * so bypassing this form changes nothing about what is accepted.
 */
export function AssetForm({
  action,
  submitLabel,
  submitPendingLabel,
  options,
  assetId,
  assetCode,
  defaults = EMPTY_ASSET_FORM_DEFAULTS,
}: Readonly<AssetFormProps>) {
  const t = useTranslations("AssetsPage");
  const [state, formAction] = useActionState(action, INITIAL_ASSET_FORM_STATE);

  const optionSets: AssetOptionSets = {
    ...options,
    conditions: enumOptions(ASSET_CONDITIONS, CONDITION_LABEL_KEYS, t),
    statuses: enumOptions(ASSET_STATUSES, STATUS_LABEL_KEYS, t),
  };

  return (
    <form
      action={formAction}
      className="flex max-w-2xl flex-col gap-8"
      noValidate
    >
      {assetId && <input type="hidden" name="id" value={assetId} />}
      {assetCode && <AssetCodeNotice assetCode={assetCode} t={t} />}
      <AssetFieldset
        legend={t("sectionDetails")}
        specs={ASSET_DETAIL_FIELD_SPECS}
        t={t}
        defaults={defaults}
        errors={state.fieldErrors}
        options={optionSets}
      />
      <AssetFieldset
        legend={t("sectionProcurement")}
        note={t("sectionProcurementNote")}
        specs={ASSET_PROCUREMENT_FIELD_SPECS}
        t={t}
        defaults={defaults}
        errors={state.fieldErrors}
        options={optionSets}
      />
      <FormError message={state.formError} />
      <SubmitButton idleLabel={submitLabel} pendingLabel={submitPendingLabel} />
    </form>
  );
}
