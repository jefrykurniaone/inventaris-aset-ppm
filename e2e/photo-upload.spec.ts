import { expect, test, type Page } from "@playwright/test";

import {
  createAssetWithPhoto,
  deletePhotoCard,
  findTheOnlyPhotoCard,
  HAS_E2E_CREDENTIALS,
  MISSING_CREDENTIALS_REASON,
  openAssetEditPage,
  readScanUrl,
  signIn,
  TEST_TIMEOUT_MS,
  uniqueAssetName,
} from "./asset-helpers";

/**
 * The photo half of the smoke path in `docs/prd.md` §7.2: sign in, create an
 * asset **with its first photo attached in the same submission**, and check
 * that the stored photo is served by the application's own route, drawn by
 * the public scan page through the image optimiser, and gone the moment it is
 * deleted.
 *
 * Photo bytes live in PostgreSQL (ADR 0009) and are served from
 * `/api/photos/<id>/<variant>`, so this spec needs no storage service and no
 * secret: CI's `e2e` job (`.github/workflows/ci.yml`) runs it on every pull
 * request against its PostgreSQL service container.
 *
 * The photo is picked on the create form, not on the edit page (issue #85).
 * One submission covers both writes: the row, then the multipart upload to
 * `/api/assets/<id>/photos` — so the navigation to the list is what proves the
 * whole pipeline ran. The edit page is where this spec goes to look at the
 * stored photo and to delete it.
 *
 * Everything up to and including that create lives in `./asset-helpers`,
 * shared with `label-printing.spec.ts`. What is left here is this spec's
 * subject: the photo's address, the scan page's hero, and the photo's
 * disappearance.
 *
 * Every photo it uploads is deleted through the interface, which removes the
 * photo's bytes from the database with its row.
 *
 * **The asset row is not cleaned up. Rows accumulate, one per run, and
 * `prisma migrate reset` is the reset.** That is deliberate: soft-deleting the
 * asset would add a second confirmation dialog, and a second failure mode, to
 * the teardown of a test whose subject is photos. A soft delete would not free
 * the row's `assetCode` sequence number either, so it would not make repeated
 * runs any cheaper than leaving the row alone does.
 */

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

const PHOTO_ADDRESS_PREFIX = "/api/photos/";
const IMAGE_CONTENT_TYPE = /^image\//;
const OPTIMISER_PATH = "/_next/image";

const PRIMARY_BADGE = /^(primary photo|foto utama)$/i;

/**
 * Opens the public scan page and checks that its hero photo was fetched
 * through the image optimiser, and that the optimiser answered `200`.
 *
 * The response is awaited rather than read off the element: the optimiser's
 * address is only ever requested by the browser, so a response to it is the
 * proof that the hero was routed through it and not served raw. The scan page
 * is where the photo's address is wrapped (`ScanPhotoGallery`); every other
 * surface renders the stored derivative as it is.
 */
async function expectScanHeroThroughOptimiser(
  page: Page,
  scanUrl: string,
): Promise<void> {
  const optimiserResponse = page.waitForResponse((response) =>
    response.url().includes(OPTIMISER_PATH),
  );
  await page.goto(scanUrl);

  const response = await optimiserResponse;
  expect(response.status()).toBe(HTTP_OK);
  expect(decodeURIComponent(response.url())).toContain(PHOTO_ADDRESS_PREFIX);
}

test.describe("photo pipeline against the application's own photo route", () => {
  test.skip(!HAS_E2E_CREDENTIALS, MISSING_CREDENTIALS_REASON);

  test("attaches a photo while creating the asset, serves it from the application, and deletes it", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    const name = uniqueAssetName("photo");
    await signIn(page);
    await createAssetWithPhoto(page, name);
    const assetId = await openAssetEditPage(page, name);

    const photoCard = await findTheOnlyPhotoCard(page);
    const image = photoCard.getByRole("img");
    await expect(image).toBeVisible();

    // The bytes are served by this application, from its database: the source
    // is a path on the same origin, and it answers an image without a session.
    const photoAddress = (await image.getAttribute("src")) ?? "";
    expect(photoAddress.startsWith(PHOTO_ADDRESS_PREFIX)).toBe(true);

    const stored = await page.request.get(photoAddress);
    expect(stored.status()).toBe(HTTP_OK);
    expect(stored.headers()["content-type"]).toMatch(IMAGE_CONTENT_TYPE);

    // Exactly one primary, and it is this photo.
    await expect(photoCard.getByText(PRIMARY_BADGE)).toHaveCount(1);

    // The public scan page, which has to be visited while the asset still has
    // its photo: its hero goes through the optimiser.
    await page.goto(`/assets/${assetId}`);
    await expectScanHeroThroughOptimiser(page, await readScanUrl(page));

    await page.goto(`/assets/${assetId}/edit`);
    await deletePhotoCard(page, await findTheOnlyPhotoCard(page));

    // There is no CDN in front of the route, so a deleted photo answers `404`
    // on the first request: asserted once, not polled.
    const deleted = await page.request.get(photoAddress);
    expect(deleted.status()).toBe(HTTP_NOT_FOUND);
  });
});
