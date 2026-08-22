import {
  ASSET_LIST_SORT_KEYS,
  MAX_ASSET_LIST_PAGE_SIZE,
  MIN_ASSET_LIST_PAGE_SIZE,
  type AssetListSortDirection,
  type AssetListSortKey,
} from "@/lib/asset-list-query";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

import type {
  AssetsPlainMessageKey,
  AssetsTranslate,
} from "./asset-field-specs";

/** One localised label per sort key and per direction — declared here, not
 * inline in the render, for the same reason `STATUS_LABEL_KEYS` lives beside
 * `AssetField` rather than inside it (S6478). */
const SORT_KEY_LABEL_KEYS: Record<AssetListSortKey, AssetsPlainMessageKey> = {
  assetCode: "sortAssetCode",
  name: "sortName",
  acquisitionYear: "sortAcquisitionYear",
  updatedAt: "sortUpdatedAt",
};

const SORT_DIRECTIONS: readonly AssetListSortDirection[] = ["asc", "desc"];

const SORT_DIRECTION_LABEL_KEYS: Record<
  AssetListSortDirection,
  AssetsPlainMessageKey
> = {
  asc: "sortDirectionAsc",
  desc: "sortDirectionDesc",
};

/** `10`, `20`, `50`, `100` — the bounds `list-schemas.ts` also enforces. */
const PAGE_SIZE_OPTIONS = [
  MIN_ASSET_LIST_PAGE_SIZE,
  20,
  50,
  MAX_ASSET_LIST_PAGE_SIZE,
] as const;

function AssetSortKeySelect({
  sort,
  t,
}: Readonly<{ sort: AssetListSortKey; t: AssetsTranslate }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="asset-list-sort">{t("sortLabel")}</Label>
      <Select id="asset-list-sort" name="sort" defaultValue={sort}>
        {ASSET_LIST_SORT_KEYS.map((key) => (
          <option key={key} value={key}>
            {t(SORT_KEY_LABEL_KEYS[key])}
          </option>
        ))}
      </Select>
    </div>
  );
}

function AssetSortDirectionSelect({
  dir,
  t,
}: Readonly<{ dir: AssetListSortDirection; t: AssetsTranslate }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="asset-list-dir">{t("sortDirectionLabel")}</Label>
      <Select id="asset-list-dir" name="dir" defaultValue={dir}>
        {SORT_DIRECTIONS.map((direction) => (
          <option key={direction} value={direction}>
            {t(SORT_DIRECTION_LABEL_KEYS[direction])}
          </option>
        ))}
      </Select>
    </div>
  );
}

function AssetPageSizeSelect({
  pageSize,
  t,
}: Readonly<{ pageSize: number; t: AssetsTranslate }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="asset-list-page-size">{t("pageSizeLabel")}</Label>
      <Select
        id="asset-list-page-size"
        name="pageSize"
        defaultValue={String(pageSize)}
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </Select>
    </div>
  );
}

interface AssetSortControlsProps {
  readonly sort: AssetListSortKey;
  readonly dir: AssetListSortDirection;
  readonly pageSize: number;
  readonly t: AssetsTranslate;
}

/** The asset list's sort-key, sort-direction and page-size controls (PRD
 * FR-2.6: sorting on asset code, name, acquisition year and last updated).
 * Three plain `<select>`s inside the same `GET` form as `AssetFilters`, so
 * choosing a sort order needs no client-side JavaScript. */
export function AssetSortControls({
  sort,
  dir,
  pageSize,
  t,
}: Readonly<AssetSortControlsProps>) {
  return (
    <>
      <AssetSortKeySelect sort={sort} t={t} />
      <AssetSortDirectionSelect dir={dir} t={t} />
      <AssetPageSizeSelect pageSize={pageSize} t={t} />
    </>
  );
}
