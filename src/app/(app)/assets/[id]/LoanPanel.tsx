import { getTranslations } from "next-intl/server";

import type { AssetStatus } from "../schemas";

/**
 * The current-loan panel (issue #10's explicit stub): the `Loan` model
 * exists (see `prisma/models/asset.prisma`) but nothing writes a row to it
 * until issue #15 ships check-out and return, so this renders a localised
 * placeholder rather than querying a table that can only ever be empty
 * right now. #15 replaces this component's body, not its mount point.
 *
 * Renders nothing for any status but `loaned` — PRD FR-6 makes `loaned` the
 * only status a loan panel is relevant to.
 */
export async function LoanPanel({
  status,
}: Readonly<{ readonly status: AssetStatus }>) {
  if (status !== "loaned") {
    return null;
  }

  const td = await getTranslations("AssetDetailPage");

  return (
    <section
      aria-labelledby="asset-loan-heading"
      className="border-border bg-muted/40 flex flex-col gap-1 rounded-md border p-4"
    >
      <h2 id="asset-loan-heading" className="text-lg font-semibold">
        {td("loanHeading")}
      </h2>
      <p className="text-muted-foreground text-sm">{td("loanStubMessage")}</p>
    </section>
  );
}
