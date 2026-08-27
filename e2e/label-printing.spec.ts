import { expect, test, type Page } from "@playwright/test";

import {
  createAssetWithPhoto,
  deletePhotoCard,
  findTheOnlyPhotoCard,
  HAS_E2E_CREDENTIALS,
  MISSING_CREDENTIALS_REASON,
  openAssetEditPage,
  signIn,
  TEST_TIMEOUT_MS,
  uniqueAssetName,
} from "./asset-helpers";

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
 * The steps it shares with that spec — sign in, create with a photo, reach
 * the edit page, delete the photo — live in `./asset-helpers` and are the
 * same code, not a copy of it. What is left here is this spec's subject: the
 * asset code, the label sheet, and the scan URL.
 *
 * Required environment is documented in `./asset-helpers`.
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

const PRINT_LABEL_LINK = /(print label|cetak label)/i;

/** The PRD FR-2.1 asset code shape, `PPM-<CATEGORY>-<YEAR>-<SEQUENCE>` — used
 * to find the code on screen without depending on a CSS class. */
const ASSET_CODE_PATTERN = /^PPM-/;

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
  test.skip(!HAS_E2E_CREDENTIALS, MISSING_CREDENTIALS_REASON);

  test("prints a label from the asset detail page and the scanned URL renders", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    const name = uniqueAssetName("label");
    await signIn(page);
    await createAssetWithPhoto(page, name);

    // This spec only needs the row to have had a photo at some point, not to
    // still have one, so the photo goes again straight away.
    const assetId = await openAssetEditPage(page, name);
    await deletePhotoCard(page, await findTheOnlyPhotoCard(page));

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
