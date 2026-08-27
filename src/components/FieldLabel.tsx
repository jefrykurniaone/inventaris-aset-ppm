import { RequiredMarker } from "@/components/RequiredMarker";
import { Label } from "@/components/ui/label";

interface FieldLabelProps {
  /** The id of the control this labels — `assetFieldId(name)` on the asset
   * form, the combobox trigger's id on a searchable picker. */
  readonly htmlFor: string;
  readonly label: string;
  /** Set when something has to point at the label element itself: the
   * searchable combobox names its trigger with `aria-labelledby`. */
  readonly id?: string;
  readonly isMarkedRequired?: boolean;
}

/**
 * One field's `<label>`, carrying the required marker when the field has one.
 *
 * One component rather than the same three lines at each control. The asset
 * form's text, select and textarea controls and the shared searchable combobox
 * all label a field the same way, so "the marker sits inside the label, after
 * the text" stays one fact in one place instead of four copies to keep in step.
 *
 * The text and the marker share an inner `<span>` because `Label` lays its
 * children out as a `gap-2` flex row: as direct children the asterisk would sit
 * a full 8px off the word it belongs to and read as its own item.
 *
 * The marker is `aria-hidden`, so it is excluded from this label's accessible
 * name — the name a combobox trigger's `aria-labelledby` resolves to stays the
 * field's words alone.
 */
export function FieldLabel({
  htmlFor,
  label,
  id,
  isMarkedRequired,
}: Readonly<FieldLabelProps>) {
  return (
    <Label id={id} htmlFor={htmlFor}>
      <span>
        {label}
        <RequiredMarker isMarkedRequired={isMarkedRequired} />
      </span>
    </Label>
  );
}
