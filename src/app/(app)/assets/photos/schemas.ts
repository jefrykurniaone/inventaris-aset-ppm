import { z } from "zod";

import { MAX_PHOTOS_PER_ASSET } from "@/lib/photo-upload";

/**
 * The wire contract between the browser and the photo endpoints (PRD FR-4.4,
 * FR-4.6; ADR 0009): the upload route's multipart fields and its response,
 * and the three management server actions' inputs.
 *
 * Shared rather than duplicated: the browser builds its upload from
 * `PHOTO_UPLOAD_FIELD` and reads the answer with `photoUploadResponseSchema`,
 * and the route parses the same fields with `photoUploadFormSchema` and
 * answers in the same shape. Bypassing the browser therefore changes nothing
 * about what is accepted — and these schemas are not the whole control
 * either. They check that the fields exist and are of the right kind; the
 * size and type rules are `inspectPhotoPart`'s, in `src/lib/photo-upload.ts`,
 * which reads the bytes rather than any claim about them.
 *
 * Declared outside `actions.ts` because a `"use server"` module may export
 * only async functions.
 */

const idSchema = z.string().trim().min(1);

/**
 * A sanity ceiling on the pixel dimensions the browser reports. The pipeline
 * resizes the longest edge to 1600 px, so anything near this is already a
 * client that did not run the compression step; the value exists so an absurd
 * number cannot be written into an `Int` column, not as a quality rule.
 */
export const MAX_REPORTED_EDGE_PX = 20_000;

/** The names of the four multipart parts one upload carries. */
export const PHOTO_UPLOAD_FIELD = {
  full: "full",
  thumbnail: "thumbnail",
  width: "width",
  height: "height",
} as const;

/** A multipart field arrives as text, so the dimensions are coerced first and
 * then held to the same bounds a number would be. */
const photoEdgeFieldSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(MAX_REPORTED_EDGE_PX);

/**
 * The upload's fields once the multipart body has been parsed. The two images
 * have to be file parts; their type and size are deliberately not checked
 * here (no `.mime()`, no `.max()`), because `inspectPhotoPart` is the one
 * definition of those rules and it reads the bytes — a second definition here
 * would also flatten "that format cannot be used" and "that photo is too
 * large" into one shapeless "invalid request".
 */
export const photoUploadFormSchema = z.object({
  assetId: z.uuid(),
  full: z.file(),
  thumbnail: z.file(),
  width: photoEdgeFieldSchema,
  height: photoEdgeFieldSchema,
});

export type PhotoUploadForm = z.infer<typeof photoUploadFormSchema>;

export const photoIdRequestSchema = z.object({
  assetId: idSchema,
  photoId: idSchema,
});

export const photoReorderRequestSchema = z.object({
  assetId: idSchema,
  photoIds: z.array(idSchema).min(1).max(MAX_PHOTOS_PER_ASSET),
});

/**
 * Every photo endpoint answers in this shape. A refusal carries an already
 * localised message rather than a code, so no caller can render an
 * unlocalised fallback and no internal error text can escape (`CLAUDE.md`).
 */
export type PhotoActionResult<Value = undefined> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly message: string };

/** The upload route's JSON body, for success and refusal alike. The browser
 * parses what it receives with this schema rather than trusting a cast, so a
 * proxy's error page or a truncated body is a failed upload, not a crash. */
export const photoUploadResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    value: z.object({ photoId: z.string().min(1) }),
  }),
  z.object({ ok: z.literal(false), message: z.string().min(1) }),
]);

export type PhotoUploadResponse = PhotoActionResult<{
  readonly photoId: string;
}>;
