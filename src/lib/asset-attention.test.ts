import { describe, expect, it } from "vitest";

import {
  ATTENTION_CONDITION,
  ATTENTION_STATUSES,
  buildAttentionWhere,
  requiresAttention,
} from "./asset-attention";

describe("buildAttentionWhere", () => {
  it("ORs status-in(in_repair, lost) with condition=poor, and carries no photo clause", () => {
    expect(buildAttentionWhere()).toEqual({
      OR: [{ status: { in: ["in_repair", "lost"] } }, { condition: "poor" }],
    });
  });
});

describe("requiresAttention", () => {
  it("is true for an in_repair asset regardless of condition", () => {
    expect(requiresAttention({ status: "in_repair", condition: "good" })).toBe(
      true,
    );
  });

  it("is true for a lost asset regardless of condition", () => {
    expect(requiresAttention({ status: "lost", condition: "good" })).toBe(true);
  });

  it("is true for a poor-condition asset regardless of status", () => {
    expect(
      requiresAttention({ status: "active", condition: ATTENTION_CONDITION }),
    ).toBe(true);
  });

  it("is false for a healthy asset — active status, good condition — and no field here can encode a missing photo any more, so this also proves a photo-less but otherwise healthy asset no longer matches", () => {
    expect(requiresAttention({ status: "active", condition: "good" })).toBe(
      false,
    );
  });

  it("is true when status and condition both trigger at once", () => {
    expect(
      requiresAttention({
        status: ATTENTION_STATUSES[0],
        condition: ATTENTION_CONDITION,
      }),
    ).toBe(true);
  });

  it("is false for the other live statuses that are not in_repair or lost", () => {
    expect(requiresAttention({ status: "loaned", condition: "good" })).toBe(
      false,
    );
    expect(requiresAttention({ status: "retired", condition: "fair" })).toBe(
      false,
    );
  });
});
