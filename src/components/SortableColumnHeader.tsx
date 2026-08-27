import { ariaSortValue, type SortDirection } from "@/lib/table-sort";
import { cn } from "@/lib/utils";

import { HiddenSearchParams } from "./HiddenSearchParams";

/** The visible direction indicator. Two filled arrows for the column being
 * sorted on and a double-headed arrow for one that merely could be, so
 * direction is carried by shape rather than by colour alone (WCAG 1.4.1) and
 * both inherit the header's own text colour, which already meets AA in both
 * themes. */
const SORT_INDICATOR: Readonly<Record<SortDirection, string>> = {
  asc: "↑",
  desc: "↓",
};

const SORTABLE_INDICATOR = "↕";

interface SortableColumnHeaderProps {
  /** The list's own path — a `GET` form posts to it with the params below. */
  readonly action: string;
  /** The whole view this header leads to: the current filters, the page reset
   * to the first, and this column's sort key and next direction. */
  readonly params: URLSearchParams;
  readonly label: string;
  readonly isActive: boolean;
  /** The direction currently in force on the list, whichever column it
   * belongs to — only announced when this is the active column. */
  readonly direction: SortDirection;
}

/**
 * One clickable column header, built as the W3C sortable-table pattern
 * describes it: a real `<button>` inside the `<th>`, and `aria-sort` on the
 * `<th>` itself carrying the direction. The button's accessible name is the
 * column label and nothing else — the state belongs on the cell, so a screen
 * reader announces it once rather than twice.
 *
 * A `GET` form rather than a link: this is a control that changes how the
 * table is ordered, the whole surface works with JavaScript disabled, and a
 * submit button is keyboard-operable by Enter and Space without a single
 * handler of our own (no `S1082` click-handler-without-keyboard-equivalent
 * to answer for). The form lives inside the `<th>` and never wraps the
 * table, so it cannot swallow the row checkboxes on the asset list.
 */
export function SortableColumnHeader({
  action,
  params,
  label,
  isActive,
  direction,
}: Readonly<SortableColumnHeaderProps>) {
  const indicator = isActive ? SORT_INDICATOR[direction] : SORTABLE_INDICATOR;

  return (
    <th
      scope="col"
      aria-sort={ariaSortValue(isActive, direction)}
      className="py-2 pr-4 font-medium"
    >
      <form action={action} method="get">
        <HiddenSearchParams params={params} />
        <button
          type="submit"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-sm font-medium",
            "hover:underline focus-visible:outline-ring focus-visible:outline-2",
            "focus-visible:outline-offset-2",
          )}
        >
          {label}
          <span aria-hidden="true">{indicator}</span>
        </button>
      </form>
    </th>
  );
}
