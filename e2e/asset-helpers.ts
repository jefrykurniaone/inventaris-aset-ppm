import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The steps both end-to-end specs walk before they get to the thing each one
 * is actually about: sign in, create an asset carrying its first photo, reach
 * that asset's edit page, and delete the photo again.
 *
 * One module rather than a copy in each spec. `photo-upload.spec.ts` and
 * `label-printing.spec.ts` both start from the same five screens, and issue
 * #85 made the create step longer still, which is what pushed the two copies
 * past SonarQube's duplication gate. What stays in a spec is what differs:
 * its asset-name prefix, its own timeouts, and every assertion about the
 * subject under test.
 *
 * Not a spec itself. Playwright's default `testMatch` collects only
 * `*.spec.ts` / `*.test.ts` under `testDir`, so this file is imported, never
 * run as a test.
 *
 * Required environment, read from `.env.local` by the dev server
 * `playwright.config.ts` starts:
 *
 *   E2E_EMAIL, E2E_PASSWORD — an existing account. `npm run db:seed` creates
 *   the first administrator; use those credentials.
 */

const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

/** Both specs skip themselves without credentials: each performs a real
 * sign-in, and there is nothing meaningful left of either without one. */
export const HAS_E2E_CREDENTIALS = EMAIL !== "" && PASSWORD !== "";

export const MISSING_CREDENTIALS_REASON =
  "E2E_EMAIL and E2E_PASSWORD must be set; this spec performs a real sign-in.";

/**
 * How long a create submission may take before the list appears.
 *
 * Since issue #85 that one submission carries the row write, a real
 * compression pass in a Web Worker, and two real uploads to Singapore — so
 * this is the budget the create step spends, not the edit page's.
 */
const UPLOAD_TIMEOUT_MS = 45_000;

/**
 * Longer than Playwright's 30 s default, because either test performs a real
 * sign-in, a real asset create with a real upload, and several real reads
 * back. It has to exceed every wait inside a test added together, or a slow
 * link fails the whole test rather than the step that was actually slow.
 */
export const TEST_TIMEOUT_MS = 180_000;

/** A 1x1 WebP. Small on purpose: what is being proven is that the pipeline
 * reaches storage, not that the compressor works, and the compressor runs on
 * this file exactly as it would on a phone photo. */
const ONE_PIXEL_WEBP_BASE64 =
  "UklGRhwAAABXRUJQVlA4TA8AAAAvAAAAAAfQ//73v/+BiOh/AAA=";

/** Only ever seen by the picker. The object path in the bucket is built
 * server-side from the asset id, so nothing downstream reads this name. */
const PIXEL_FILE_NAME = "e2e-pixel.webp";

/**
 * A required `<select>` renders a disabled placeholder at index 0 (see
 * `AssetSelectField` in `AssetFormFields.tsx`), so the first choosable entry
 * is index 1.
 */
const FIRST_REAL_OPTION_INDEX = 1;

/**
 * Every required picker on the create form, by field name, split by the shape
 * of the control.
 *
 * `status` is deliberately absent from both: `EMPTY_ASSET_FORM_DEFAULTS`
 * presets it to `active`, so it is already valid. Everything else here is
 * required by `assetSchema` and, left unset, comes back as a re-rendered form
 * rather than a navigation — which is what these specs used to hang on.
 *
 * `categoryId` and `roomId` became searchable comboboxes with issue #88, so
 * they are opened and chosen from a listbox; `condition` is a fixed
 * enumeration and stays a native `<select>`.
 */
const REQUIRED_SELECT_FIELDS = ["condition"] as const;
const REQUIRED_COMBOBOX_FIELDS = ["categoryId", "roomId"] as const;

/**
 * Issue #103's required-field markers, named by what they are checked against.
 *
 * `name` is required and marked; `brand` is optional and must stay unmarked —
 * one of each is what makes the assertion mean something, since "no asterisk
 * anywhere" would pass a check that only looked at the optional field.
 *
 * The legend regex is bilingual like every other locator here: these specs run
 * against whichever locale the session lands on.
 */
const REQUIRED_LEGEND = /(required field|wajib diisi)/i;
const REQUIRED_MARKER = "*";
const MARKED_FIELD = "name";
const UNMARKED_FIELD = "brand";

const SIGN_IN_BUTTON = /(sign in|masuk)/i;
const SAVE_ASSET_BUTTON = /(save asset|simpan aset)/i;
const EDIT_LINK = /^(edit|ubah)$/i;
const CHOOSE_FILE_LABEL = /(choose a file|pilih berkas)/i;
const DELETE_PHOTO_BUTTON = /^(delete|hapus)$/i;
const CONFIRM_DELETE_BUTTON = /(delete photo|hapus foto)/i;

const PHOTOS_REGION = /^(photos|foto)$/i;

const EDIT_URL_PATTERN = /\/assets\/([^/]+)\/edit$/;

/** A name no other row can collide with, so the list's `q` filter narrows the
 * table to exactly one row. The prefix says which spec left it behind. */
export function uniqueAssetName(prefix: string): string {
  return `E2E ${prefix} ${Date.now()}`;
}

/**
 * Locates a form control by the id `fieldId()` gives it in
 * `AssetFormFields.tsx`.
 *
 * These are the application's own ids, not test ids added for these specs —
 * nothing was changed in `src/` to make this work. They are used in place of
 * `getByLabel` with a bilingual regex because that is what broke: `/nama/i`
 * matches "Nama", "Nama penanggung jawab" and every other label containing
 * the word, and `.first()` papered over the ambiguity by picking whichever
 * happened to come first in the DOM.
 */
function assetField(page: Page, name: string): Locator {
  return page.locator(`#asset-${name}`);
}

export async function signIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/(password|kata sandi)/i).fill(PASSWORD);
  await page.getByRole("button", { name: SIGN_IN_BUTTON }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/** Opens a searchable combobox and takes its first option. The panel is a
 * Radix popover holding a cmdk listbox, so both are reached by role rather
 * than by a class or a test id. */
async function chooseFirstComboboxOption(page: Page, name: string) {
  await assetField(page, name).click();

  const option = page.getByRole("listbox").getByRole("option").first();
  await expect(option).toBeVisible();
  await option.click();
}

/**
 * The required-field markers on the form as it first renders (issue #103).
 *
 * Labels are located by their `for` attribute rather than by text, for the same
 * reason `assetField` exists: a bilingual text regex matches more than one
 * label. The marker itself is `aria-hidden`, so it is read out of the label's
 * text content and never looked for by role.
 *
 * The legend is asserted to appear exactly once. Two would mean a form nested
 * inside a form, or the component rendered per fieldset.
 */
async function expectRequiredFieldMarkers(page: Page): Promise<void> {
  await expect(page.getByText(REQUIRED_LEGEND)).toHaveCount(1);
  await expect(
    page.locator(`label[for="asset-${MARKED_FIELD}"]`),
  ).toContainText(REQUIRED_MARKER);
  await expect(
    page.locator(`label[for="asset-${UNMARKED_FIELD}"]`),
  ).not.toContainText(REQUIRED_MARKER);
}

/** Fills every field `assetSchema` requires. `acquisitionYear` is the current
 * year, which is always inside the schema's `1970 … currentYear + 1` window,
 * so this does not go stale. */
async function fillRequiredAssetFields(page: Page, name: string) {
  await assetField(page, "name").fill(name);
  await assetField(page, "acquisitionYear").fill(
    String(new Date().getFullYear()),
  );
  for (const field of REQUIRED_SELECT_FIELDS) {
    await assetField(page, field).selectOption({
      index: FIRST_REAL_OPTION_INDEX,
    });
  }
  for (const field of REQUIRED_COMBOBOX_FIELDS) {
    await chooseFirstComboboxOption(page, field);
  }
}

/**
 * Creates one asset through the real form, with its first photo picked on
 * that same form (issue #85).
 *
 * Picking only remembers the file: nothing is compressed or uploaded until
 * the row exists and has an id to key its object paths on.
 */
export async function createAssetWithPhoto(
  page: Page,
  name: string,
): Promise<void> {
  await page.goto("/assets/new");
  await expectRequiredFieldMarkers(page);
  await fillRequiredAssetFields(page, name);

  await page.getByLabel(CHOOSE_FILE_LABEL).setInputFiles({
    name: PIXEL_FILE_NAME,
    mimeType: "image/webp",
    buffer: Buffer.from(ONE_PIXEL_WEBP_BASE64, "base64"),
  });

  await page.getByRole("button", { name: SAVE_ASSET_BUTTON }).click();

  // A create that succeeded, photo and all, navigates to the list. A rejected
  // one re-renders the form with inline errors and never navigates, and a
  // create whose photo failed replaces the form with the "asset saved, photo
  // not uploaded" notice and stays put — so this one wait is the assertion
  // that every required field was filled *and* that the photo reached
  // storage.
  await page.waitForURL("**/assets", { timeout: UPLOAD_TIMEOUT_MS });
}

/**
 * Opens the edit page of the asset just created — which is where the photo
 * section lives — and returns the asset's id read off the resulting URL, so
 * no caller has to query the database to learn it.
 *
 * Reached through the list's free-text filter rather than by clicking the
 * asset's name: on the list the name is a plain table cell, and the row's only
 * link is the edit link. `q` matches `name` case-insensitively (see
 * `buildAssetListWhere`), so a timestamped name narrows the table to one row.
 *
 * Scoped to the `<table>` because `AssetTable` renders the same rows twice —
 * a table at `md` and above and a card list below it, switched by CSS, both
 * always present in the DOM. At this project's Desktop Chrome viewport only
 * the table is in the accessibility tree, so an unscoped lookup happens to
 * find one link; saying which one is meant here means a narrower viewport
 * fails on a missing table rather than on a strict-mode violation.
 */
export async function openAssetEditPage(
  page: Page,
  name: string,
): Promise<string> {
  await page.goto(`/assets?q=${encodeURIComponent(name)}`);

  const editLink = page
    .getByRole("table")
    .getByRole("link", { name: EDIT_LINK });
  await expect(editLink).toHaveCount(1);

  await editLink.click();
  await page.waitForURL(EDIT_URL_PATTERN);

  const match = EDIT_URL_PATTERN.exec(new URL(page.url()).pathname);
  if (!match) {
    throw new Error(
      `e2e/asset-helpers: could not read an asset id off the edit URL ${page.url()}`,
    );
  }
  return match[1];
}

/**
 * The one photo card on the edit page, once the section is on screen.
 *
 * The photo is already there — it was uploaded during the create submission —
 * so the count is a plain assertion rather than a wait. Assertions belong
 * inside the card rather than across the whole section: the section's own
 * description paragraph also contains the words "primary photo", and an
 * unscoped text match counted it as a second primary.
 */
export async function findTheOnlyPhotoCard(page: Page): Promise<Locator> {
  const photos = page.getByRole("region", { name: PHOTOS_REGION });
  await expect(photos).toBeVisible();

  const photoCard = photos.getByRole("listitem");
  await expect(photoCard).toHaveCount(1);
  return photoCard;
}

/** Deletes a photo through the interface, confirmation dialog and all, so the
 * run leaves nothing behind in the bucket. */
export async function deletePhotoCard(
  page: Page,
  photoCard: Locator,
): Promise<void> {
  await photoCard.getByRole("button", { name: DELETE_PHOTO_BUTTON }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: CONFIRM_DELETE_BUTTON })
    .click();
  await expect(photoCard).toHaveCount(0);
}
