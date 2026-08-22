import type { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_LABEL_OFFSET } from "@/lib/label-pagination";
import { ASSETS_PATH } from "@/lib/paths";

type LabelsT = Awaited<ReturnType<typeof getTranslations<"AssetLabelsPage">>>;

interface OffsetFormProps {
  readonly ids: readonly string[];
  readonly offset: number;
  readonly t: LabelsT;
}

const MIN_LABEL_OFFSET = 0;
const OFFSET_STEP = 1;

/**
 * The starting-offset control (PRD FR-5.4): "render this many empty
 * positions first, so a partly used sheet is not wasted". A plain `GET`
 * form rather than a client-side handler — the offset is state that belongs
 * in the URL (so the resulting sheet can be bookmarked or reprinted
 * identically), and a native form submission needs no keyboard handling of
 * its own to satisfy WCAG AA: every browser already makes a `<form>`'s
 * controls and submit button keyboard-operable.
 */
export function OffsetForm({ ids, offset, t }: Readonly<OffsetFormProps>) {
  return (
    <form
      method="get"
      action={`${ASSETS_PATH}/labels`}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="ids" value={ids.join(",")} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="label-offset">{t("offsetLabel")}</Label>
        <Input
          id="label-offset"
          name="offset"
          type="number"
          min={MIN_LABEL_OFFSET}
          max={MAX_LABEL_OFFSET}
          step={OFFSET_STEP}
          defaultValue={offset}
          className="w-24"
        />
      </div>
      <Button type="submit" variant="outline" size="sm">
        {t("offsetApply")}
      </Button>
      <p className="text-muted-foreground w-full text-xs">{t("offsetHint")}</p>
    </form>
  );
}
