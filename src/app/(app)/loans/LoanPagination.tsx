import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LOANS_PATH } from "@/lib/paths";

import type { LoansTranslate } from "./loan-field-specs";
import { withLoanListPage, type LoanListSearchParams } from "./list-schemas";

/**
 * The loans list's pager. Renders nothing once there is nothing to page
 * through, which is also what keeps the empty states in `LoanTable` free of a
 * stray "page 1 of 1" underneath them.
 *
 * Every href it emits comes from `withLoanListPage`, which is the one function
 * that writes a loans-list URL — so the guarantee that a generated link never
 * carries borrower data is checked in one place and unit-tested there.
 */

interface LoanPaginationProps {
  readonly params: LoanListSearchParams;
  readonly pageCount: number;
  readonly totalCount: number;
  readonly t: LoansTranslate;
}

/** A real link when the direction is reachable, a real disabled `<button>` —
 * never a disabled-looking link — otherwise, so a screen reader and a keyboard
 * both see it as unavailable. */
function LoanPaginationLink({
  href,
  label,
  isEnabled,
}: Readonly<{ href: string; label: string; isEnabled: boolean }>) {
  if (!isEnabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export function LoanPagination({
  params,
  pageCount,
  totalCount,
  t,
}: Readonly<LoanPaginationProps>) {
  if (totalCount === 0) {
    return null;
  }

  const { page } = params;

  return (
    <nav
      aria-label={t("paginationLabel")}
      className="flex flex-wrap items-center justify-between gap-4 text-sm"
    >
      <p className="text-muted-foreground">
        {t("paginationSummary", { page, pageCount, totalCount })}
      </p>
      <div className="flex gap-2">
        <LoanPaginationLink
          href={`${LOANS_PATH}?${withLoanListPage(params, page - 1)}`}
          label={t("paginationPrevious")}
          isEnabled={page > 1}
        />
        <LoanPaginationLink
          href={`${LOANS_PATH}?${withLoanListPage(params, page + 1)}`}
          label={t("paginationNext")}
          isEnabled={page < pageCount}
        />
      </div>
    </nav>
  );
}
