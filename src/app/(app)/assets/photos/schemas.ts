import { z } from "zod";

import { MAX_PHOTOS_PER_ASSET } from "@/lib/photo-upload";

/**
 * The wire contract between the browser and the photo server actions
 * (PRD FR-4.4, FR-4.6).
 *
 * Shared rather than duplicated: the same schema that shapes the request in
 * the browser parses it again inside the action. Bypassing the browser
 * therefore changes nothing about what is accepted — and the schema is not the
 * whole control either. `attachPhotoAction` re-reads the object's real size
 * and content type out of the bucket afterwards, because everything here is
 * still a client's account of a file the server has never seen.
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

const photoEdgeSchema = z.number().int().positive().max(MAX_REPORTED_EDGE_PX);

/**
 * What the browser asks for before it uploads: two objects, the full image and
 * its thumbnail, each declared with the type and size it is about to send.
 *
 * The content type is a plain string here and the size carries no ceiling, on
 * purpose. Both are checked immediately afterwards by `acceptPhoto`, which is
 * the one definition of the allowlist and the cap — putting a `z.enum` and a
 * `.max()` here as well would be a second definition that has to be kept in
 * step, and it would flatten "that format cannot be used" and "that photo is
 * too large" into one shapeless "invalid request". This schema's job is that
 * the fields exist and are of the right kind; the rules are `acceptPhoto`'s.
 */
export const photoUploadRequestSchema = z.object({
  assetId: idSchema,
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
  thumbnailContentType: z.string().trim().min(1),
  thumbnailSizeBytes: z.number().int().positive(),
});

export type PhotoUploadRequest = z.infer<typeof photoUploadRequestSchema>;

/** What the browser reports once both objects are in the bucket. The paths
 * are checked against `isPhotoObjectPathFor` before anything is done with
 * them, so naming another asset's object here reaches nothing. */
export const photoAttachRequestSchema = z.object({
  assetId: idSchema,
  objectPath: idSchema,
  thumbnailObjectPath: idSchema,
  width: photoEdgeSchema,
  height: photoEdgeSchema,
});

export type PhotoAttachRequest = z.infer<typeof photoAttachRequestSchema>;

export const photoIdRequestSchema = z.object({
  assetId: idSchema,
  photoId: idSchema,
});

export const photoReorderRequestSchema = z.object({
  assetId: idSchema,
  photoIds: z.array(idSchema).min(1).max(MAX_PHOTOS_PER_ASSET),
});

/** One signed upload target as the browser receives it. The token is already
 * inside `signedUrl`; nothing on the client ever handles it separately. */
export interface PhotoUploadTarget {
  readonly objectPath: string;
  readonly signedUrl: string;
}

export interface PhotoUploadTargets {
  readonly full: PhotoUploadTarget;
  readonly thumbnail: PhotoUploadTarget;
}

/**
 * Every photo action answers in this shape. A refusal carries an already
 * localised message rather than a code, so no caller can render an
 * unlocalised fallback and no internal error text can escape (`CLAUDE.md`).
 */
export type PhotoActionResult<Value = undefined> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly message: string };

export type PhotoUploadRequestResult = PhotoActionResult<PhotoUploadTargets>;
