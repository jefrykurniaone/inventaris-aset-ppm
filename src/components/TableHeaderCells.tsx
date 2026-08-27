import type { ReactNode } from "react";

import { nextSortDirection, type SortDirection } from "@/lib/table-sort";

import { SortableColumnHeader } from "./SortableColumnHeader";
import type { TableColumnSpec } from "./table-columns";

/** A column that does not say otherwise sorts A-to-Z on its first click. */
const DEFAULT_INITIAL_DIRECTION: SortDirection = "asc";

interface TableHeaderCellsProps<Key extends string> {
  readonly action: string;
  readonly columns: readonly TableColumnSpec<Key>[];
  /** The sort key currently in force, so exactly one column reads as active. */
  readonly sortKey: Key;
  readonly direction: SortDirection;
  /** The whole query string for one target ordering — filters carried
   * forward, page reset to the first. Each list owns its own serialiser, so
   * this component never has to know what a filter looks like. */
  readonly paramsFor: (
    sortKey: Key,
    direction: SortDirection,
  ) => URLSearchParams;
}

/**
 * Every `<th>` of one table's header row: a plain cell for a column with no
 * `sortKey`, and `SortableColumnHeader` for each curated sortable one.
 *
 * Returns the cells rather than a `<tr>`, so a table that needs a leading
 * cell of its own — the asset list's select-all checkbox — can put one
 * before them without this component knowing about it.
 */
export function TableHeaderCells<Key extends string>({
  action,
  columns,
  sortKey,
  direction,
  paramsFor,
}: Readonly<TableHeaderCellsProps<Key>>): ReactNode {
  return columns.map((column) => {
    if (!column.sortKey) {
      return (
        <th key={column.id} scope="col" className="py-2 pr-4 font-medium">
          {column.label}
        </th>
      );
    }

    const isActive = column.sortKey === sortKey;
    const target = nextSortDirection(
      isActive,
      direction,
      column.initialDirection ?? DEFAULT_INITIAL_DIRECTION,
    );

    return (
      <SortableColumnHeader
        key={column.id}
        action={action}
        params={paramsFor(column.sortKey, target)}
        label={column.label}
        isActive={isActive}
        direction={direction}
      />
    );
  });
}
