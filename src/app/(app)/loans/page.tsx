import { getLocale, getTranslations } from "next-intl/server";

import { totalLoanListPageCount } from "@/lib/loan-list-query";
import { requireUser } from "@/lib/require-user";

import { LoanFilters } from "./LoanFilters";
import { LoanPagination } from "./LoanPagination";
import { LoanTable } from "./LoanTable";
import {
  loanListSearchParamsSchema,
  type LoanListSearchParams,
} from "./list-schemas";
import { listLoansPage } from "./list-queries";

/**
 * The loan register index (PRD FR-6): every loan, filterable by state and
 * searchable by borrower name or by asset, paginated server-side.
 *
 * `requireUser()`, not `requireAdmin()` — FR-1.4 gives `staff` the run of the
 * register — and the route sits inside the `(app)` group, which is what
 * "protected" means in this codebase. Borrower name, email and unit appear here
 * and only here: there is no anonymous route that reads them.
 *
 * One `now` is taken for the whole render and threaded through the query and
 * the row states, so a request that straddled a due date cannot show a row the
 * `active` filter found wearing an `overdue` badge.
 */

interface LoansPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Whether any filter is active — the page-overflow case (a page number past
 * the last page with no filter at all) reads the same way, since both mean
 * "these criteria, not the whole register, produced zero rows". */
function isFilteredView(params: LoanListSearchParams): boolean {
  return Boolean(params.q) || Boolean(params.state) || params.page > 1;
}

export default async function LoansPage({
  searchParams,
}: Readonly<LoansPageProps>) {
  await requireUser();
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("LoansPage"),
  ]);
  const params = loanListSearchParamsSchema.parse(await searchParams);

  const now = new Date();
  const { rows, totalCount } = await listLoansPage(
    {
      search: params.q,
      state: params.state,
      page: params.page,
      pageSize: params.pageSize,
    },
    now,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <LoanFilters params={params} t={t} />
      <LoanTable
        loans={rows}
        locale={locale}
        t={t}
        isFilteredView={isFilteredView(params)}
      />
      <LoanPagination
        params={params}
        pageCount={totalLoanListPageCount(totalCount, params.pageSize)}
        totalCount={totalCount}
        t={t}
      />
    </div>
  );
}
