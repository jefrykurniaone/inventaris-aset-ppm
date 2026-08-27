import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/lib/table-sort";

import { HiddenSearchParams } from "./HiddenSearchParams";

interface TablePageSizeSelectProps {
  readonly action: string;
  /** The current view minus `pageSize`, with `page` already reset to the
   * first — the select below supplies the size, and a page number from a
   * larger page count would land past the end of the smaller one. */
  readonly params: URLSearchParams;
  readonly pageSize: number;
  /** Unique per table on the page, because the `<label>` points at it. */
  readonly id: string;
}

/**
 * The page-size control every list table carries (issue #87): the preset
 * scale 10 / 20 / 50 / 100, defaulting to 10, persisted in the URL.
 *
 * A plain `GET` form with a visible submit button, not an auto-submitting
 * `onChange` — choosing a value must not trigger an unannounced page change
 * (WCAG 3.2.2), which is the same rule `RoomBuildingFilter` and
 * `AssetFilters` already follow.
 */
export async function TablePageSizeSelect({
  action,
  params,
  pageSize,
  id,
}: Readonly<TablePageSizeSelectProps>) {
  const t = await getTranslations("TableControls");

  return (
    <form
      action={action}
      method="get"
      className="flex flex-wrap items-end gap-2"
    >
      <HiddenSearchParams params={params} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{t("pageSizeLabel")}</Label>
        <Select
          id={id}
          name="pageSize"
          defaultValue={String(pageSize)}
          className="w-24"
        >
          {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="outline">
        {t("pageSizeApply")}
      </Button>
    </form>
  );
}
