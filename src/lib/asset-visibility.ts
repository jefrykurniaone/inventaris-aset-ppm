/**
 * PRD §8.2's public/restricted split, expressed as two Prisma selections
 * (issue #11).
 *
 * The rule this module establishes for the codebase: **a public read must not
 * name a restricted column at all.** Fetching the whole row and hiding half of
 * it in a component is a defect, not a style preference — the restricted half
 * is commercial data and personal data on named staff, and a field that is
 * never selected cannot leak through a serialised RSC payload, a logged query,
 * a cache entry, or a component someone edits next year.
 *
 * So there is no single "asset select" with a filter applied afterwards. There
 * are two literal objects. `ANONYMOUS_ASSET_SCAN_SELECT` is written out by
 * hand and contains only public columns; `SIGNED_IN_ASSET_SCAN_SELECT` is that
 * object plus the restricted half. `asset-visibility.test.ts` walks the
 * anonymous object recursively and fails if any restricted name appears
 * anywhere in it, nested selects included — the assertion is against the
 * selection object itself, not against rendered output, because rendered
 * output is downstream of the leak this guards.
 *
 * Nothing here imports `@/generated/prisma`: these are plain object literals
 * that Prisma infers the result shape from at the call site, which keeps the
 * generated client behind `src/lib/db.ts` as the seam rules require.
 */

/** The two audiences a scan page serves. Not roles: FR-1.4 gives `staff` and
 * `admin` the same read, and the split here is signed-in versus not. */
export type ScanAudience = "anonymous" | "signedIn";

/**
 * The RESTRICTED half of §8.2, by column name, including both sides of each
 * relation (the scalar foreign key and the relation field) — naming either one
 * in a public select is the same leak.
 *
 * Exported so the test iterates this list rather than restating it, which is
 * what makes adding a restricted column to the schema and forgetting the
 * public query a test failure instead of a review question.
 */
export const RESTRICTED_ASSET_COLUMNS = [
  "purchasePrice",
  "fundingSourceId",
  "fundingSource",
  "procurementDocNo",
  "vendor",
  "warrantyUntil",
  "custodianName",
  "custodianEmail",
  "createdById",
  "createdBy",
] as const;

/**
 * The restricted half of `Loan`. An anonymous visitor may learn *that* an item
 * is out and *when it is due* (FR-6.2) and nothing else — who is holding it is
 * personal data, and a printed label is readable by anyone who walks past it.
 */
export const RESTRICTED_LOAN_COLUMNS = [
  "borrowerName",
  "borrowerEmail",
  "borrowerUnit",
  "handledById",
  "handledBy",
] as const;

/**
 * Prisma's `SortOrder` needs the literal type, and `as const` here is what
 * supplies it: a plain `const x = "asc"` has a *widening* literal type that
 * becomes `string` the moment it is read into a mutable object property.
 *
 * `as const` on the enclosing objects instead would be the obvious move and is
 * the wrong one — it would freeze the `orderBy` arrays into readonly tuples,
 * which Prisma's generated inputs reject.
 */
const ASCENDING = "asc" as const;
const DESCENDING = "desc" as const;

/** One loan row is enough: the page only ever shows the open loan, and the
 * partial state "on loan, due <date>" has no second value to show. */
const OPEN_LOAN_LIMIT = 1;

/** Primary first, then the curator's order, then oldest first — the same order
 * `src/app/(app)/assets/photos/queries.ts` uses, so no surface re-sorts what
 * it is handed and the primary photo (FR-4.1) is always `photos[0]`. */
const PHOTO_SELECT = {
  orderBy: [
    { isPrimary: DESCENDING },
    { sortOrder: ASCENDING },
    { createdAt: ASCENDING },
  ],
  select: {
    id: true,
    objectPath: true,
    thumbObjectPath: true,
    isPrimary: true,
    // Intrinsic dimensions, so `next/image` reserves the right box before the
    // bytes arrive. Layout shift is the cheapest thing to lose on the one
    // surface with a 2.5 s budget over 4G.
    width: true,
    height: true,
  } as const,
};

/** An open loan is one that has not been returned (see the `Loan` comment in
 * `prisma/models/asset.prisma`). Earliest due date first, so the one row taken
 * is the one that matters. */
const OPEN_LOAN_WHERE = { returnedAt: null };
const OPEN_LOAN_ORDER = { dueAt: ASCENDING };

const ANONYMOUS_LOAN_SELECT = {
  where: OPEN_LOAN_WHERE,
  orderBy: OPEN_LOAN_ORDER,
  take: OPEN_LOAN_LIMIT,
  select: { dueAt: true } as const,
};

const SIGNED_IN_LOAN_SELECT = {
  where: OPEN_LOAN_WHERE,
  orderBy: OPEN_LOAN_ORDER,
  take: OPEN_LOAN_LIMIT,
  select: {
    dueAt: true,
    checkedOutAt: true,
    borrowerName: true,
    borrowerEmail: true,
    borrowerUnit: true,
    handledBy: { select: { name: true } },
  } as const,
};

/**
 * Every column §8.2 marks PUBLIC, and two that are not fields at all:
 *
 * - `deletedAt` is the state discriminator FR-2.5 needs. Its *value* never
 *   reaches a page — only whether it is null picks the "withdrawn" branch over
 *   the normal one — and reading it in the same round trip is what keeps the
 *   scan page one query, which the 2.5 s target on 4G cares about.
 * - `id` is deliberately absent. An anonymous visitor has no use for it, the
 *   scan page is keyed on an unguessable token precisely so the register
 *   cannot be enumerated, and the signed-in half below adds it back for the
 *   one thing that needs it: the link to `/assets/<id>`.
 */
const PUBLIC_ASSET_SELECT = {
  assetCode: true,
  name: true,
  condition: true,
  status: true,
  brand: true,
  model: true,
  serialNumber: true,
  universityAssetCode: true,
  acquisitionYear: true,
  notes: true,
  qrToken: true,
  deletedAt: true,
  category: { select: { name: true, nameEn: true } },
  room: { select: { name: true, building: { select: { name: true } } } },
  photos: PHOTO_SELECT,
} as const;

/** The restricted half, added only for a signed-in reader (FR-6.3). */
const SIGNED_IN_ONLY_ASSET_SELECT = {
  id: true,
  purchasePrice: true,
  procurementDocNo: true,
  vendor: true,
  warrantyUntil: true,
  custodianName: true,
  custodianEmail: true,
  createdAt: true,
  updatedAt: true,
  fundingSource: { select: { name: true } },
  createdBy: { select: { name: true } },
} as const;

/** What `GET /a/<token>` selects for a visitor with no session. */
export const ANONYMOUS_ASSET_SCAN_SELECT = {
  ...PUBLIC_ASSET_SELECT,
  loans: ANONYMOUS_LOAN_SELECT,
} as const;

/** The same page for a signed-in visitor: the public columns plus the
 * restricted ones, in one query rather than two. */
export const SIGNED_IN_ASSET_SCAN_SELECT = {
  ...PUBLIC_ASSET_SELECT,
  ...SIGNED_IN_ONLY_ASSET_SELECT,
  loans: SIGNED_IN_LOAN_SELECT,
} as const;

/**
 * The selection one audience is allowed to read.
 *
 * The return type is the union of the two literal objects rather than a
 * widened common shape, so a caller that branches on the audience still gets
 * Prisma's exact row type for the branch it took. `queries.ts` branches for
 * that reason; this function exists so the mapping from audience to selection
 * lives here, next to the split it enforces, and is unit-tested.
 */
export function assetScanSelectFor(
  audience: ScanAudience,
): typeof ANONYMOUS_ASSET_SCAN_SELECT | typeof SIGNED_IN_ASSET_SCAN_SELECT {
  if (audience === "anonymous") {
    return ANONYMOUS_ASSET_SCAN_SELECT;
  }
  return SIGNED_IN_ASSET_SCAN_SELECT;
}
