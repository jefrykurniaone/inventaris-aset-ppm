import { expect, test, type Page } from "@playwright/test";

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
 * It cleans up after itself. The asset it creates is soft-deleted, which is
 * the only deletion FR-2.5 offers, and every photo it uploads is deleted
 * through the interface first, which removes the objects from the bucket.
 * Anything a failed run still leaves behind is cleared by
 * `npm run storage:purge:dev`.
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

function uniqueAssetName(): string {
  return `E2E photo ${Date.now()}`;
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/(password|kata sandi)/i).fill(PASSWORD);
  await page.getByRole("button", { name: /(sign in|masuk)/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/** Creates one asset through the real form and returns the edit URL, which is
 * where the photo section lives. */
async function createAsset(page: Page, name: string): Promise<string> {
  await page.goto("/assets/new");
  await page
    .getByLabel(/(name|nama)/i)
    .first()
    .fill(name);

  for (const label of [/(category|kategori)/i, /(room|ruang)/i]) {
    const select = page.getByLabel(label).first();
    await select.selectOption({ index: 1 });
  }

  await page.getByRole("button", { name: /(save|simpan)/i }).click();
  await page.waitForURL("**/assets");

  await page.getByRole("link", { name }).click();
  await page.waitForURL(/\/assets\/[^/]+\/edit$/);
  return page.url();
}

test.describe("photo pipeline against the real development bucket", () => {
  test.skip(
    EMAIL === "" || PASSWORD === "",
    "E2E_EMAIL and E2E_PASSWORD must be set; this spec performs a real sign-in.",
  );

  test("uploads a photo, serves it from storage, and deletes both row and object", async ({
    page,
  }) => {
    const name = uniqueAssetName();
    await signIn(page);
    await createAsset(page, name);

    const photos = page.getByRole("region", { name: /(photos|foto)/i });
    await expect(photos).toBeVisible();

    await photos.getByLabel(/(choose a file|pilih berkas)/i).setInputFiles({
      name: "e2e-pixel.webp",
      mimeType: "image/webp",
      buffer: Buffer.from(ONE_PIXEL_WEBP_BASE64, "base64"),
    });

    const image = photos.getByRole("img").first();
    await expect(image).toBeVisible({ timeout: 30_000 });

    // The bytes are served from object storage, not from this application:
    // the source is the bucket's public URL, and it answers without a session.
    const source = await image.getAttribute("src");
    expect(source).toContain("/storage/v1/object/public/");

    const stored = await page.request.get(`${source}?cachebust=${Date.now()}`);
    expect(stored.status()).toBe(HTTP_OK);

    // Exactly one primary, and it is this photo.
    await expect(photos.getByText(/(primary photo|foto utama)/i)).toHaveCount(
      1,
    );

    await photos.getByRole("button", { name: /(delete|hapus)$/i }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /(delete photo|hapus foto)/i })
      .click();
    await expect(photos.getByRole("img")).toHaveCount(0);

    // The object is gone from the bucket too. A unique query string defeats
    // the CDN, which answers 200 from cache for a short while after a delete —
    // see `docs/supabase-storage-provisioning.md`.
    const afterDelete = await page.request.get(
      `${source}?cachebust=${Date.now()}`,
    );
    expect(afterDelete.status()).not.toBe(HTTP_OK);
  });
});
