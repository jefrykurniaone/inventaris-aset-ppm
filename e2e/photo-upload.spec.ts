import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The photo half of the smoke path in `docs/prd.md` §7.2: sign in, create an
 * asset, upload a photo to the **real** `asset-photos-dev` bucket, and check
 * that the stored object is reachable at its public URL.
 *
 * This is the only test in the suite that touches the network deliberately.
 * That is the accepted cost of ADR 0005: there is no local storage driver, so
 * "photo upload works" cannot be demonstrated offline. **CI holds no Supabase
 * secrets and runs no end-to-end tests** — `npm run test:e2e` is run by hand,
 * against a local development server and a local database.
 *
 * Every photo it uploads is deleted through the interface, which removes the
 * objects from the bucket; anything a failed run leaves behind is cleared by
 * `npm run storage:purge:dev`.
 *
 * **The asset row is not cleaned up. Rows accumulate, one per run, and
 * `prisma migrate reset` is the reset.** That is deliberate: soft-deleting the
 * asset would add a second confirmation dialog, and a second failure mode, to
 * the teardown of a test whose subject is photos. A soft delete would not free
 * the row's `assetCode` sequence number either, so it would not make repeated
 * runs any cheaper than leaving the row alone does.
 *
 * Required environment, all read from `.env.local` by the dev server this
 * spec's `webServer` starts:
 *
 *   E2E_EMAIL, E2E_PASSWORD — an existing account. `npm run db:seed` creates
 *   the first administrator; use those credentials.
 */

const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

/** A 1x1 WebP. Small on purpose: what is being proven is that the pipeline
 * reaches storage, not that the compressor works, and the compressor runs on
 * this file exactly as it would on a phone photo. */
const ONE_PIXEL_WEBP_BASE64 =
  "UklGRhwAAABXRUJQVlA4TA8AAAAvAAAAAAfQ//73v/+BiOh/AAA=";

const HTTP_OK = 200;

/**
 * Longer than Playwright's 30 s default, because this one test performs a
 * real sign-in, a real asset create, a real compression pass in a Web Worker,
 * two real uploads to Singapore and several real reads back — the last of
 * which waits on CDN propagation. It has to exceed the upload wait and the
 * propagation ceiling below, added together, or a slow link fails the whole
 * test rather than the step that was actually slow.
 */
const TEST_TIMEOUT_MS = 180_000;

/** How long the compress-and-upload round trip may take before the photo is
 * expected to appear. */
const UPLOAD_TIMEOUT_MS = 45_000;

/**
 * How long the CDN may keep serving a deleted object before the public URL
 * stops answering `200`.
 *
 * A ceiling, not a cost: the poll below ends the moment the status changes, so
 * a healthy run pays propagation time and nothing more. The full ceiling is
 * only ever spent by a run that is about to fail anyway.
 */
const DELETE_PROPAGATION_TIMEOUT_MS = 90_000;
const DELETE_POLL_INTERVAL_MS = 2_000;

/**
 * A required `<select>` renders a disabled placeholder at index 0 (see
 * `AssetSelectField` in `AssetFormFields.tsx`), so the first choosable entry
 * is index 1.
 */
const FIRST_REAL_OPTION_INDEX = 1;

/**
 * Every required picker on the create form, by field name.
 *
 * `status` is deliberately absent: `EMPTY_ASSET_FORM_DEFAULTS` presets it to
 * `active`, so it is already valid. Everything else here is required by
 * `assetSchema` and, left unset, comes back as a re-rendered form rather than
 * a redirect — which is what this spec used to hang on.
 */
const REQUIRED_SELECT_FIELDS = ["categoryId", "roomId", "condition"] as const;

const SIGN_IN_BUTTON = /(sign in|masuk)/i;
const SAVE_ASSET_BUTTON = /(save asset|simpan aset)/i;
const EDIT_LINK = /^(edit|ubah)$/i;
const PHOTOS_REGION = /^(photos|foto)$/i;
const CHOOSE_FILE_LABEL = /(choose a file|pilih berkas)/i;
const PRIMARY_BADGE = /^(primary photo|foto utama)$/i;
const DELETE_PHOTO_BUTTON = /^(delete|hapus)$/i;
const CONFIRM_DELETE_BUTTON = /(delete photo|hapus foto)/i;

function uniqueAssetName(): string {
  return `E2E photo ${Date.now()}`;
}

/**
 * Locates a form control by the id `fieldId()` gives it in
 * `AssetFormFields.tsx`.
 *
 * These are the application's own ids, not test ids added for this spec —
 * nothing was changed in `src/` to make this work. They are used in place of
 * `getByLabel` with a bilingual regex because that is what broke: `/nama/i`
 * matches "Nama", "Nama penanggung jawab" and every other label containing
 * the word, and `.first()` papered over the ambiguity by picking whichever
 * happened to come first in the DOM.
 */
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

/**
 * Creates one asset through the real form, filling **every** field
 * `assetSchema` requires.
 *
 * `acquisitionYear` is the current year, which is always inside the schema's
 * `1970 … currentYear + 1` window, so this does not go stale.
 */
async function createAsset(page: Page, name: string): Promise<void> {
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

  await page.getByRole("button", { name: SAVE_ASSET_BUTTON }).click();

  // A successful create redirects to the list. A rejected one re-renders the
  // form with inline errors and never navigates, so this is also the assertion
  // that every required field above was actually filled.
  await page.waitForURL("**/assets");
}

/**
 * Opens the edit page of the asset just created, which is where the photo
 * section lives.
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
async function openAssetPhotoPage(page: Page, name: string): Promise<void> {
  await page.goto(`/assets?q=${encodeURIComponent(name)}`);

  const editLink = page
    .getByRole("table")
    .getByRole("link", { name: EDIT_LINK });
  await expect(editLink).toHaveCount(1);

  await editLink.click();
  await page.waitForURL(/\/assets\/[^/]+\/edit$/);
}

test.describe("photo pipeline against the real development bucket", () => {
  test.skip(
    EMAIL === "" || PASSWORD === "",
    "E2E_EMAIL and E2E_PASSWORD must be set; this spec performs a real sign-in.",
  );

  test("uploads a photo, serves it from storage, and deletes both row and object", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    const name = uniqueAssetName();
    await signIn(page);
    await createAsset(page, name);
    await openAssetPhotoPage(page, name);

    const photos = page.getByRole("region", { name: PHOTOS_REGION });
    await expect(photos).toBeVisible();

    await photos.getByLabel(CHOOSE_FILE_LABEL).setInputFiles({
      name: "e2e-pixel.webp",
      mimeType: "image/webp",
      buffer: Buffer.from(ONE_PIXEL_WEBP_BASE64, "base64"),
    });

    // One `<li>` per photo. Everything about the stored photo is asserted
    // inside the card rather than across the whole section: the section's own
    // description paragraph also contains the words "primary photo", and an
    // unscoped text match counted it as a second primary.
    const photoCard = photos.getByRole("listitem");
    await expect(photoCard).toHaveCount(1, { timeout: UPLOAD_TIMEOUT_MS });

    const image = photoCard.getByRole("img");
    await expect(image).toBeVisible();

    // The bytes are served from object storage, not from this application:
    // the source is the bucket's public URL, and it answers without a session.
    const source = await image.getAttribute("src");
    expect(source).toContain("/storage/v1/object/public/");

    const stored = await page.request.get(`${source}?cachebust=${Date.now()}`);
    expect(stored.status()).toBe(HTTP_OK);

    // Exactly one primary, and it is this photo.
    await expect(photoCard.getByText(PRIMARY_BADGE)).toHaveCount(1);

    await photoCard.getByRole("button", { name: DELETE_PHOTO_BUTTON }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: CONFIRM_DELETE_BUTTON })
      .click();
    await expect(photoCard).toHaveCount(0);

    // The object is gone from the bucket too.
    //
    // Polled rather than asserted once. A delete does not reach the CDN edge
    // instantly, and the public URL keeps answering 200 from cache until it
    // does. A unique query string does **not** force a miss — Supabase's cache
    // key is the object path alone. That is measured, not assumed: on the run
    // that produced issue #60, this URL answered 200 while `listObjectPaths`
    // reported the bucket holding zero objects at the same moment.
    // `docs/supabase-storage-provisioning.md` used to claim the opposite and
    // has been corrected.
    //
    // The cachebust is kept only so that a cache keyed on the full URL, if one
    // sits anywhere between this process and the edge, cannot serve a stale
    // copy. It is the polling that handles propagation.
    //
    // This still fails hard on a real leak: an object that genuinely survived
    // the delete answers 200 until the ceiling runs out, and the test fails.
    await expect
      .poll(
        async () => {
          const response = await page.request.get(
            `${source}?cachebust=${Date.now()}`,
          );
          return response.status();
        },
        {
          timeout: DELETE_PROPAGATION_TIMEOUT_MS,
          intervals: [DELETE_POLL_INTERVAL_MS],
        },
      )
      .not.toBe(HTTP_OK);
  });
});
