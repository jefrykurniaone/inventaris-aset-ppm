import { getTranslations } from "next-intl/server";

import type { TableColumnSpec } from "@/components/table-columns";
import { TableHeaderCells } from "@/components/TableHeaderCells";
import type { Locale } from "@/i18n/config";
import {
  DEFAULT_FUNDING_SOURCE_SORT_KEY,
  withMasterDataSort,
  type FundingSourceSortKey,
  type MasterDataListParams,
} from "@/lib/master-data-list-query";
import { ADMIN_FUNDING_SOURCES_PATH } from "@/lib/paths";

import { FundingSourceRow } from "./FundingSourceRow";
import type { FundingSourceListRow } from "./queries";

type AdminFundingSourcesT = Awaited<
  ReturnType<typeof getTranslations<"AdminFundingSourcesPage">>
>;

type AdminFundingSourcesMessageKey = Parameters<AdminFundingSourcesT>[0];

interface FundingSourceTableProps {
  readonly fundingSources: readonly FundingSourceListRow[];
  readonly params: MasterDataListParams<FundingSourceSortKey>;
  readonly locale: Locale;
  readonly t: AdminFundingSourcesT;
}

interface FundingSourceColumn {
  readonly id: string;
  readonly labelKey: AdminFundingSourcesMessageKey;
  readonly sortKey?: FundingSourceSortKey;
}

/** The curated sortable set (issue #87): name — this table's identity, since
 * a funding source has no code — and creation time. Notes are prose. */
const FUNDING_SOURCE_COLUMNS: readonly FundingSourceColumn[] = [
  { id: "name", labelKey: "columnName", sortKey: "name" },
  { id: "notes", labelKey: "columnNotes" },
  { id: "status", labelKey: "columnStatus" },
  { id: "createdAt", labelKey: "columnCreatedAt", sortKey: "createdAt" },
  { id: "edit", labelKey: "columnEdit" },
  { id: "active", labelKey: "columnActive" },
  { id: "delete", labelKey: "columnDelete" },
];

function toColumnSpecs(
  t: AdminFundingSourcesT,
): readonly TableColumnSpec<FundingSourceSortKey>[] {
  return FUNDING_SOURCE_COLUMNS.map((column) => ({
    id: column.id,
    label: t(column.labelKey),
    sortKey: column.sortKey,
    initialDirection: column.sortKey === "createdAt" ? "desc" : "asc",
  }));
}

/** The funding source list itself (PRD FR-3.1), split out of
 * `AdminFundingSourcesPage` so that function stays under the 40-line limit. */
export function FundingSourceTable({
  fundingSources,
  params,
  locale,
  t,
}: Readonly<FundingSourceTableProps>) {
  if (fundingSources.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("emptyState")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            <TableHeaderCells
              action={ADMIN_FUNDING_SOURCES_PATH}
              columns={toColumnSpecs(t)}
              sortKey={params.sort}
              direction={params.dir}
              paramsFor={(sortKey, direction) =>
                withMasterDataSort(
                  new URLSearchParams(),
                  params,
                  DEFAULT_FUNDING_SOURCE_SORT_KEY,
                  sortKey,
                  direction,
                )
              }
            />
          </tr>
        </thead>
        <tbody>
          {fundingSources.map((fundingSource) => (
            <FundingSourceRow
              key={fundingSource.id}
              fundingSource={fundingSource}
              locale={locale}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
