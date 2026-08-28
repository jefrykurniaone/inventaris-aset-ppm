import { getLocale, getTranslations } from "next-intl/server";

import { TableFooterControls } from "@/components/TableFooterControls";
import { ADMIN_SIGN_IN_ACTIVITY_PATH } from "@/lib/paths";
import { requireAdmin } from "@/lib/require-user";
import {
  buildSignInActivityListPagerParams,
  buildSignInActivityListParamsWithoutPageSize,
  parseSignInActivityListParams,
  totalSignInActivityListPageCount,
  type SignInActivityListParams,
} from "@/lib/sign-in-activity-list-query";
import { SIGN_IN_ATTEMPT_RETENTION_DAYS } from "@/lib/sign-in-lockout";

import { ActiveSignInLocks } from "./ActiveSignInLocks";
import { listActiveSignInLocks, listSignInActivityPage } from "./queries";
import { SignInActivityFilters } from "./SignInActivityFilters";
import { SignInActivityTable } from "./SignInActivityTable";

interface AdminSignInActivityPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Whether any filter is active — a page number past the last page with no
 * filter at all reads the same way, since both mean "these criteria, not the
 * whole trail, produced zero rows". Mirrors `../../loans/page.tsx`'s
 * `isFilteredView`. */
function isFilteredView(params: SignInActivityListParams): boolean {
  return Boolean(params.search) || Boolean(params.outcome) || params.page > 1;
}

/**
 * The admin sign-in activity trail (issue #125, spec #124): every logged
 * `/sign-in/email` attempt, newest first, searchable by address and
 * filterable by outcome, paginated with the shared table controls.
 *
 * `AdminLayout` already refuses a non-admin before this page renders;
 * `requireAdmin()` is called again here, the same defence-in-depth
 * `AdminUsersPage` documents, because a page can in principle be reached
 * without passing through its layout.
 *
 * The active-locks section above the trail (issue #126) reads the same table
 * at the same instant: one `now` is taken here and handed to both, so the
 * locks the section lists cannot disagree with the attempts the trail shows.
 */
export default async function AdminSignInActivityPage({
  searchParams,
}: Readonly<AdminSignInActivityPageProps>) {
  await requireAdmin();
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("AdminSignInActivityPage"),
  ]);
  const params = parseSignInActivityListParams(await searchParams);

  const now = new Date();
  const [{ rows, totalCount }, activeLocks] = await Promise.all([
    listSignInActivityPage(params),
    listActiveSignInLocks(now),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("retentionNote", { days: SIGN_IN_ATTEMPT_RETENTION_DAYS })}
        </p>
      </div>
      <ActiveSignInLocks locks={activeLocks} locale={locale} t={t} />
      <SignInActivityFilters params={params} t={t} />
      <SignInActivityTable
        attempts={rows}
        params={params}
        locale={locale}
        t={t}
        isFilteredView={isFilteredView(params)}
      />
      <TableFooterControls
        action={ADMIN_SIGN_IN_ACTIVITY_PATH}
        pageSizeParams={buildSignInActivityListParamsWithoutPageSize(params)}
        pagerParams={buildSignInActivityListPagerParams(params)}
        page={params.page}
        pageSize={params.pageSize}
        pageCount={totalSignInActivityListPageCount(
          totalCount,
          params.pageSize,
        )}
        totalCount={totalCount}
        pageSizeSelectId="admin-sign-in-activity-page-size"
      />
    </div>
  );
}
