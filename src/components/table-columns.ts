import type { SortDirection } from "@/lib/table-sort";

/**
 * One column of a list table, as data.
 *
 * A table describes its header row as an array of these and hands it to
 * `TableHeaderCells`, which is what keeps "which columns are sortable" a
 * curated list in one readable place per table rather than a property spread
 * across eleven hand-written `<th>` elements. A column with no `sortKey` is
 * deliberately not sortable — photo and action columns never carry one.
 */
export interface TableColumnSpec<Key extends string = string> {
  /** Stable React key, and the column's identity independent of its label. */
  readonly id: string;
  /** Already-localised header text. The table translates; this file does
   * not, so it stays importable from a plain module with no `next-intl`
   * dependency. */
  readonly label: string;
  /** Present only on the curated sortable columns. */
  readonly sortKey?: Key;
  /** The direction this column sorts in when it is first activated — A-to-Z
   * for text, newest-first for a date. */
  readonly initialDirection?: SortDirection;
}
