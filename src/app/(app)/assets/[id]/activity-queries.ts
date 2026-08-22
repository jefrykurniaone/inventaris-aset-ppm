import { z } from "zod";

import { db } from "@/lib/db";

/**
 * The read for the activity timeline (PRD FR-8.2), windowed rather than
 * paginated with a page number: the timeline only ever grows at the front
 * (newest first), so "show more" extending one window is simpler than a
 * page 2 that would need to know how many rows page 1 already showed.
 *
 * `ACTIVITY_WINDOW_STEP` never renders unbounded rows (issue #10's explicit
 * constraint) — the search param this schema validates can request no more
 * than `ACTIVITY_WINDOW_MAX` regardless of what a hand-edited URL asks for.
 */

export const ACTIVITY_WINDOW_STEP = 20;
const ACTIVITY_WINDOW_MAX = 200;

const activityWindowSchema = z
  .unknown()
  .optional()
  .transform((raw) => {
    const value = typeof raw === "string" ? Number(raw) : NaN;
    if (!Number.isInteger(value) || value < ACTIVITY_WINDOW_STEP) {
      return ACTIVITY_WINDOW_STEP;
    }
    return Math.min(value, ACTIVITY_WINDOW_MAX);
  });

/** Validates the `activity` search param, falling back to the first window
 * for anything missing, non-numeric, or out of range. */
export function parseActivityWindow(raw: unknown): number {
  return activityWindowSchema.parse(raw);
}

export interface AssetActivityRow {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly createdAt: Date;
  readonly actorName: string;
}

export interface AssetActivityWindow {
  readonly rows: readonly AssetActivityRow[];
  readonly hasMore: boolean;
}

/**
 * Up to `windowSize` activity rows for one asset, newest first (FR-8.2), plus
 * whether an older row exists beyond the window. Fetches one row past the
 * window rather than a separate `count` query, so "is there more" costs
 * nothing extra.
 */
export async function findAssetActivityWindow(
  assetId: string,
  windowSize: number,
): Promise<AssetActivityWindow> {
  const rows = await db.assetActivity.findMany({
    where: { assetId },
    orderBy: { createdAt: "desc" },
    take: windowSize + 1,
    select: {
      id: true,
      type: true,
      payload: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  const hasMore = rows.length > windowSize;
  const windowed = hasMore ? rows.slice(0, windowSize) : rows;

  return {
    hasMore,
    rows: windowed.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload,
      createdAt: row.createdAt,
      actorName: row.actor.name,
    })),
  };
}
