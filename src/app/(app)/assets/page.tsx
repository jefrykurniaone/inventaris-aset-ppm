// A deliberately minimal index, replaced wholesale by issue #8 — which adds
// free-text search, the six filters, pagination, sorting and row selection
// (PRD FR-2.6). It exists here because #7 has nowhere else to send a
// successful create, and because "a soft-deleted asset disappears from lists"
// is not a checkable claim without a list. Nothing beyond a table, a create
// link and a per-row edit link belongs in this file.

import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { NEW_ASSET_PATH } from "@/lib/paths";
import { requireUser } from "@/lib/require-user";

import { AssetTable } from "./AssetTable";
import { listAssets } from "./queries";

/**
 * The asset register index. `requireUser()`, not `requireAdmin()`:
 * PRD FR-1.4 gives `staff` the run of the register, and
 * `src/app/(app)/layout.tsx` has already refused a signed-out visitor before
 * this page renders — the call here is the same explicit belt-and-braces
 * every page under `(app)` makes.
 */
export default async function AssetsPage() {
  await requireUser();
  const t = await getTranslations("AssetsPage");
  const assets = await listAssets();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button asChild>
          <Link href={NEW_ASSET_PATH}>{t("createLink")}</Link>
        </Button>
      </div>
      <AssetTable assets={assets} t={t} />
    </div>
  );
}
