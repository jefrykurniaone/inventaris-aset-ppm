/**
 * Which field labels carry the required marker.
 *
 * "Required" and "marked required" are deliberately not the same set. A field
 * the schema requires but the form pre-fills with a valid default can never be
 * submitted empty, so an asterisk on it warns about nothing: the asset form's
 * `status` arrives as `active` from `EMPTY_ASSET_FORM_DEFAULTS`, and marking it
 * would teach the user that the asterisk means "you may still have work to do
 * here" when it does not.
 *
 * The decision is data on the field spec and is only read here. Nothing in this
 * module — or in `RequiredMarker` — knows a field name: a spec table that grows
 * a second pre-filled field says so by setting `hasPrefilledDefault`, and no
 * code changes. That is the whole point of keeping the exemption on the table
 * rather than as a name check inside the component.
 */

/**
 * The two flags on a field spec that decide its marker. Structural on purpose:
 * every form's own spec type satisfies it without importing anything from here,
 * so this module stays free of any one form's field-name union.
 */
export interface RequiredMarkerFieldSpec {
  /** The schema rejects this field empty. Also drives `required` /
   * `aria-required` on the control, which is untouched by the marker. */
  readonly isRequired?: boolean;
  /** Pre-filled with a valid default, so it can never reach the server empty
   * and needs no marker even while it stays schema-required. */
  readonly hasPrefilledDefault?: boolean;
}

/** Required, minus the pre-filled-default exemption. */
export function isMarkedRequired(spec: RequiredMarkerFieldSpec): boolean {
  return spec.isRequired === true && spec.hasPrefilledDefault !== true;
}
