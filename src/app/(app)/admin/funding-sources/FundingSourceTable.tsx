import { getTranslations } from "next-intl/server";

import { FundingSourceRow } from "./FundingSourceRow";
import type { FundingSourceListRow } from "./queries";

type AdminFundingSourcesT = Awaited<
  ReturnType<typeof getTranslations<"AdminFundingSourcesPage">>
>;

interface FundingSourceTableProps {
  readonly fundingSources: readonly FundingSourceListRow[];
  readonly t: AdminFundingSourcesT;
}

const COLUMN_KEYS = [
  "columnName",
  "columnNotes",
  "columnStatus",
  "columnEdit",
  "columnActive",
  "columnDelete",
] as const;

/** The funding source list itself (PRD FR-3.1), split out of
 * `AdminFundingSourcesPage` so that function stays under the 40-line limit. */
export function FundingSourceTable({
  fundingSources,
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
            {COLUMN_KEYS.map((key) => (
              <th key={key} scope="col" className="py-2 pr-4 font-medium">
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fundingSources.map((fundingSource) => (
            <FundingSourceRow
              key={fundingSource.id}
              fundingSource={fundingSource}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
