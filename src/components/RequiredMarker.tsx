/** A text glyph rather than an icon dependency — the choice `OptionComboboxField`
 * and `SortableColumnHeader` already make for their marks. */
const REQUIRED_MARKER_GLYPH = "*";

interface RequiredMarkerProps {
  /**
   * Whether this label carries the marker — the decision `isMarkedRequired`
   * derived from the caller's field spec, passed in rather than re-derived.
   * This component holds no field-name knowledge at all.
   */
  readonly isMarkedRequired?: boolean;
}

/**
 * The red asterisk on a required field's label.
 *
 * `aria-hidden` on purpose, and it is the part of this component that matters
 * most. The control beside it already carries `required` / `aria-required`, so
 * a screen reader announces the field as required from that alone; a spoken
 * "star" next to it would be the same fact a second time. The asterisk is the
 * *visual* half of the pair and `FormRequiredLegend` is the sentence that
 * explains it — which is also why nothing here is focusable: a plain `<span>`
 * with no `tabIndex` adds no tab stop.
 *
 * Colour is `--destructive-text`, the token `FieldError` and `FormError`
 * already use for error-adjacent text and the one asserted at 4.5:1 against
 * `--background` in both themes (issue #37). The surface token `--destructive`
 * is not interchangeable with it and would fail that ratio in the dark theme.
 */
export function RequiredMarker({
  isMarkedRequired = false,
}: Readonly<RequiredMarkerProps>) {
  if (!isMarkedRequired) {
    return null;
  }

  return (
    <span aria-hidden="true" className="text-destructive-text ml-0.5">
      {REQUIRED_MARKER_GLYPH}
    </span>
  );
}
