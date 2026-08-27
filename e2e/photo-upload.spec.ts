import { expect, test } from "@playwright/test";

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
 * The photo half of the smoke path in `docs/prd.md` §7.2: sign in, create an
 * asset **with its first photo attached in the same submission**, uploading
 * to the **real** `asset-photos-dev` bucket, and check that the stored object
 * is reachable at its public URL.
 *
 * The photo is picked on the create form, not on the edit page (issue #85).
 * One submission covers both writes: the server action registers the row and
 * returns its id, then the browser compresses, uploads to a signed URL and
 * attaches — so the navigation to the list is what proves the whole pipeline
 * ran. The edit page is still where this spec goes to look at the stored
 * photo and to delete it, and that flow is unchanged.
 *
 * Everything up to and including that create lives in `./asset-helpers`,
 * shared with `label-printing.spec.ts`. What is left here is this spec's
 * subject: the object in the bucket, and its disappearance.
 *
 * This is the only test in the suite that touches the network deliberately.
 * That is the accepted cost of ADR 0005: there is no local storage driver, so
 * "photo upload works" cannot be demonstrated offline. CI's `e2e` job
 * (`.github/workflows/ci.yml`) runs this spec only once `E2E_EMAIL`,
 * `E2E_PASSWORD`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
 * provisioned as repository secrets; until then it stays a warning rather
 * than a failure, and `npm run test:e2e` run by hand against a local
 * development server and a local database is the only way to exercise it.
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
 */

const HTTP_OK = 200;

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

const PRIMARY_BADGE = /^(primary photo|foto utama)$/i;

test.describe("photo pipeline against the real development bucket", () => {
  test.skip(!HAS_E2E_CREDENTIALS, MISSING_CREDENTIALS_REASON);

  test("attaches a photo while creating the asset, serves it from storage, and deletes both row and object", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    const name = uniqueAssetName("photo");
    await signIn(page);
    await createAssetWithPhoto(page, name);
    await openAssetEditPage(page, name);

    const photoCard = await findTheOnlyPhotoCard(page);
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

    await deletePhotoCard(page, photoCard);

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
