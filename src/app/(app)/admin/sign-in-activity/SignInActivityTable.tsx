import type { TableColumnSpec } from "@/components/table-columns";
import { TableHeaderCells } from "@/components/TableHeaderCells";
import type { Locale } from "@/i18n/config";
import { ADMIN_SIGN_IN_ACTIVITY_PATH } from "@/lib/paths";
import {
  withSignInActivityListSort,
  type SignInActivityListParams,
  type SignInActivityListSortKey,
} from "@/lib/sign-in-activity-list-query";
import type { SortDirection } from "@/lib/table-sort";

import type { SignInActivityListRow } from "./queries";
import type { AdminSignInActivityTranslate } from "./sign-in-activity-field-specs";
import { SignInActivityRow } from "./SignInActivityRow";

interface SignInActivityColumn {
  readonly id: string;
  readonly labelKey: Parameters<AdminSignInActivityTranslate>[0];
  readonly sortKey?: SignInActivityListSortKey;
  readonly initialDirection?: SortDirection;
}

/** Address and outcome carry no header sort (issue #125): outcome has three
 * values, which sorts nothing useful, and address is searched, not ordered
 * by. Only the timestamp is sortable, newest-first on first click. */
const SIGN_IN_ACTIVITY_COLUMNS: readonly SignInActivityColumn[] = [
  { id: "address", labelKey: "columnAddress" },
  { id: "outcome", labelKey: "columnOutcome" },
  {
    id: "createdAt",
    labelKey: "columnTimestamp",
    sortKey: "createdAt",
    initialDirection: "desc",
  },
];

function toColumnSpecs(
  t: AdminSignInActivityTranslate,
): readonly TableColumnSpec<SignInActivityListSortKey>[] {
  return SIGN_IN_ACTIVITY_COLUMNS.map((column) => ({
    id: column.id,
    label: t(column.labelKey),
    sortKey: column.sortKey,
    initialDirection: column.initialDirection,
  }));
}

interface SignInActivityTableProps {
  readonly attempts: readonly SignInActivityListRow[];
  readonly params: SignInActivityListParams;
  readonly locale: Locale;
  readonly t: AdminSignInActivityTranslate;
  /** Distinguishes the two empty states (issue #125): an empty trail reads
   * "no attempts recorded", a filter with no matches reads "no attempt
   * matches" — the same zero rows, two different messages, mirroring
   * `LoanTable`'s `isFilteredView`. */
  readonly isFilteredView: boolean;
}

/** The trail itself, split out of `AdminSignInActivityPage` so that function
 * stays inside the project's 40-line limit — the same reason `UserTable` is
 * split out of `AdminUsersPage`. */
export function SignInActivityTable({
  attempts,
  params,
  locale,
  t,
  isFilteredView,
}: Readonly<SignInActivityTableProps>) {
  if (attempts.length === 0) {
    const emptyStateKey = isFilteredView ? "emptyStateFiltered" : "emptyState";
    return <p className="text-muted-foreground text-sm">{t(emptyStateKey)}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            <TableHeaderCells
              action={ADMIN_SIGN_IN_ACTIVITY_PATH}
              columns={toColumnSpecs(t)}
              sortKey={params.sort}
              direction={params.dir}
              paramsFor={(sortKey, direction) =>
                withSignInActivityListSort(params, sortKey, direction)
              }
            />
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => (
            <SignInActivityRow
              key={attempt.id}
              attempt={attempt}
              locale={locale}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
