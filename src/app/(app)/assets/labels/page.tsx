import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ASSETS_PATH } from "@/lib/paths";
import { requireUser } from "@/lib/require-user";

interface AssetLabelsPageProps {
  readonly searchParams: Promise<{ readonly ids?: string }>;
}

const idsParamSchema = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) =>
    value ? value.split(",").filter((id) => id.trim().length > 0) : [],
  );

/**
 * Deliberately minimal stub. The asset list's "print labels" action (PRD
 * FR-2.6) hands its selection here because bulk label printing itself is
 * issue #12, which has not merged — #12 replaces this page wholesale with
 * the real A4 label sheet (FR-5.4). It exists only so the action has
 * somewhere to land, the same way #7 shipped a minimal `/assets` index for
 * #8 to replace.
 */
export default async function AssetLabelsPage({
  searchParams,
}: Readonly<AssetLabelsPageProps>) {
  await requireUser();
  const t = await getTranslations("AssetsPage");
  const { ids: rawIds } = await searchParams;
  const ids = idsParamSchema.parse(rawIds);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("labelsStubTitle")}
      </h1>
      <p className="text-muted-foreground text-sm">
        {t("labelsStubDescription", { count: ids.length })}
      </p>
      <Button asChild variant="outline" className="w-fit">
        <Link href={ASSETS_PATH}>{t("backToList")}</Link>
      </Button>
    </div>
  );
}
