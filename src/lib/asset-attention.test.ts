import { describe, expect, it } from "vitest";

import {
  ATTENTION_CONDITION,
  ATTENTION_STATUS,
  buildAttentionWhere,
  requiresAttention,
} from "./asset-attention";

describe("buildAttentionWhere", () => {
  it("ORs the three FR-9.1 conditions, including a no-photo check expressed as a relation filter", () => {
    expect(buildAttentionWhere()).toEqual({
      OR: [
        { status: "in_repair" },
        { condition: "poor" },
        { photos: { none: {} } },
      ],
    });
  });
});

describe("requiresAttention", () => {
  it("is true for an in_repair asset regardless of condition or photo", () => {
    expect(
      requiresAttention({
        status: ATTENTION_STATUS,
        condition: "good",
        hasPhoto: true,
      }),
    ).toBe(true);
  });

  it("is true for a poor-condition asset regardless of status or photo", () => {
    expect(
      requiresAttention({
        status: "active",
        condition: ATTENTION_CONDITION,
        hasPhoto: true,
      }),
    ).toBe(true);
  });

  it("is true for an asset with no photo attached, even when otherwise fine", () => {
    expect(
      requiresAttention({
        status: "active",
        condition: "good",
        hasPhoto: false,
      }),
    ).toBe(true);
  });

  it("is false only when none of the three conditions hold", () => {
    expect(
      requiresAttention({
        status: "active",
        condition: "good",
        hasPhoto: true,
      }),
    ).toBe(false);
  });

  it("is true when every condition holds at once", () => {
    expect(
      requiresAttention({
        status: ATTENTION_STATUS,
        condition: ATTENTION_CONDITION,
        hasPhoto: false,
      }),
    ).toBe(true);
  });
});
