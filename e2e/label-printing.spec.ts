import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The full demo-critical smoke path (PRD §7.2, issue #12): sign in, create an
 * asset with its first photo attached in the same submission, open its bulk
 * label print view, then open the public scan URL the printed label encodes
 * and confirm it renders.
 *
 * The photo is picked on the create form rather than on the edit page (issue
 * #85), so reaching the list is what proves the compress-and-upload pipeline
 * ran; the edit page is only where the photo is deleted again.
 *
 * Authored here but **never executed** by issue #12's executor — CLAUDE.md's
 * "never start a dev server, never run Playwright" rule for this ticket. The
 * orchestrator runs `npm run test:e2e` after merge, against a local
 * development server and a local database, same as `photo-upload.spec.ts`.
 *
 * Reuses that spec's patterns exactly, rather than inventing new ones: fields
 * located by the app's own `#asset-*` ids, the list's `q` filter plus the
 * row's `Ubah`/`Edit` link to reach the edit page, locators scoped to the
 * photo card `listitem`, and an upload timeout generous enough for a real
 * compression pass and a real upload to Singapore.
 *
 * Required environment, read from `.env.local` by the dev server this spec's
 * `webServer` starts (same two variables `photo-upload.spec.ts` documents):
 *
 *   E2E_EMAIL, E2E_PASSWORD — an existing account. `npm run db:seed` creates
 *   the first administrator; use those credentials.
 *
 * **The asset row is not cleaned up**, for the same reason
 * `photo-upload.spec.ts` leaves its own rows alone: soft-deleting it would
 * add a second confirmation dialog and a second failure mode to a test whose
 * subject is printing and scanning, and would not free the row's
 * `assetCode` sequence number either. Rows accumulate, one per run —
 * `prisma migrate reset` is the reset. The uploaded photo *is* deleted
 * through the interface, same as the other spec, so this run leaves nothing
 * behind in object storage.
 */

const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

/** A 1x1 WebP — see `photo-upload.spec.ts` for why the size does not matter
 * here: what is being proven is that the pipeline reaches storage. */
const ONE_PIXEL_WEBP_BASE64 =
  "UklGRhwAAABXRUJQVlA4TA8AAAAvAAAAAAfQ//73v/+BiOh/AAA=";

/** Sign-in, asset create, a real compression pass, two real uploads and one
 * real delete, plus the label and scan page navigations — see
 * `photo-upload.spec.ts` for the same budget reasoning. */
const TEST_TIMEOUT_MS = 180_000;
const UPLOAD_TIMEOUT_MS = 45_000;

const FIRST_REAL_OPTION_INDEX = 1;
const REQUIRED_SELECT_FIELDS = ["categoryId", "roomId", "condition"] as const;

const SIGN_IN_BUTTON = /(sign in|masuk)/i;
const SAVE_ASSET_BUTTON = /(save asset|simpan aset)/i;
const EDIT_LINK = /^(edit|ubah)$/i;
const PHOTOS_REGION = /^(photos|foto)$/i;
const CHOOSE_FILE_LABEL = /(choose a file|pilih berkas)/i;
const PRINT_LABEL_LINK = /(print label|cetak label)/i;
const DELETE_PHOTO_BUTTON = /^(delete|hapus)$/i;
const CONFIRM_DELETE_BUTTON = /(delete photo|hapus foto)/i;

/** The PRD FR-2.1 asset code shape, `PPM-<CATEGORY>-<YEAR>-<SEQUENCE>` — used
 * to find the code on screen without depending on a CSS class. */
const ASSET_CODE_PATTERN = /^PPM-/;

function uniqueAssetName(): string {
  return `E2E label ${Date.now()}`;
}

/** Same convention as `photo-upload.spec.ts`'s `assetField`: the app's own
 * ids, not test ids added for this spec. */
function assetField(page: Page, name: string): Locator {
  return page.locator(`#asset-${name}`);
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/(password|kata sandi)/i).fill(PASSWORD);
  await page.getByRole("button", { name: SIGN_IN_BUTTON }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/** Fills every field `assetSchema` requires and picks the first photo on the
 * same form — see `photo-upload.spec.ts` for why each field is here, and why
 * reaching the list is what proves the upload ran. */
async function createAssetWithPhoto(page: Page, name: string): Promise<void> {
  await page.goto("/assets/new");

  await assetField(page, "name").fill(name);
  await assetField(page, "acquisitionYear").fill(
    String(new Date().getFullYear()),
  );
  for (const field of REQUIRED_SELECT_FIELDS) {
    await assetField(page, field).selectOption({
      index: FIRST_REAL_OPTION_INDEX,
    });
  }

  await page.getByLabel(CHOOSE_FILE_LABEL).setInputFiles({
    name: "e2e-label-pixel.webp",
    mimeType: "image/webp",
    buffer: Buffer.from(ONE_PIXEL_WEBP_BASE64, "base64"),
  });

  await page.getByRole("button", { name: SAVE_ASSET_BUTTON }).click();
  await page.waitForURL("**/assets", { timeout: UPLOAD_TIMEOUT_MS });
}

/**
 * Reaches the edit page through the list's free-text filter, exactly as
 * `photo-upload.spec.ts`'s `openAssetPhotoPage` does, and returns the
 * asset's id read off the resulting URL — so the caller never has to query
 * the database to learn it.
 */
async function openAssetEditPage(page: Page, name: string): Promise<string> {
  await page.goto(`/assets?q=${encodeURIComponent(name)}`);

  const editLink = page
    .getByRole("table")
    .getByRole("link", { name: EDIT_LINK });
  await expect(editLink).toHaveCount(1);

  await editLink.click();
  await page.waitForURL(/\/assets\/[^/]+\/edit$/);

  const match = /\/assets\/([^/]+)\/edit$/.exec(new URL(page.url()).pathname);
  if (!match) {
    throw new Error(
      `label-printing.spec: could not read an asset id off the edit URL ${page.url()}`,
    );
  }
  return match[1];
}

/** Deletes the photo the create step attached, so this run leaves nothing in
 * the bucket — this spec only needs the row to have had a photo at some
 * point, not to still have one. */
async function removeTheOnePhoto(page: Page): Promise<void> {
  const photos = page.getByRole("region", { name: PHOTOS_REGION });
  await expect(photos).toBeVisible();

  const photoCard = photos.getByRole("listitem");
  await expect(photoCard).toHaveCount(1);

  await photoCard.getByRole("button", { name: DELETE_PHOTO_BUTTON }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: CONFIRM_DELETE_BUTTON })
    .click();
  await expect(photoCard).toHaveCount(0);
}

/** The asset code shown on the detail page header — plain text, no role or
 * test id, so it is found by the shape FR-2.1 guarantees it has. */
async function readAssetCode(page: Page): Promise<string> {
  const code = await page.getByText(ASSET_CODE_PATTERN).first().textContent();
  if (!code) {
    throw new Error("label-printing.spec: asset code not found on detail page");
  }
  return code.trim();
}

/** The public scan URL, read off the detail page's own link rather than
 * built from the database — proving the page the user would actually click
 * resolves to a working scan, not merely that `buildScanUrl` is correct in
 * isolation. */
async function readScanUrl(page: Page): Promise<string> {
  const link = page.locator('a[href*="/a/"]');
  await expect(link).toHaveCount(1);
  const href = await link.getAttribute("href");
  if (!href) {
    throw new Error("label-printing.spec: scan link has no href");
  }
  return href;
}

test.describe("bulk label printing and the public scan path", () => {
  test.skip(
    EMAIL === "" || PASSWORD === "",
    "E2E_EMAIL and E2E_PASSWORD must be set; this spec performs a real sign-in.",
  );

  test("prints a label from the asset detail page and the scanned URL renders", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    const name = uniqueAssetName();
    await signIn(page);
    await createAssetWithPhoto(page, name);

    const assetId = await openAssetEditPage(page, name);
    await removeTheOnePhoto(page);

    await page.goto(`/assets/${assetId}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    const assetCode = await readAssetCode(page);
    const scanUrl = await readScanUrl(page);

    await page.getByRole("link", { name: PRINT_LABEL_LINK }).click();
    await page.waitForURL(/\/assets\/labels\?ids=/);

    // The label sheet shows the same asset code and QR code the detail page
    // did — proof the print view received the right selection, not merely
    // *a* sheet.
    await expect(page.getByText(assetCode, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("img", { name: new RegExp(assetCode) }),
    ).toBeVisible();

    await page.goto(scanUrl);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });
});
