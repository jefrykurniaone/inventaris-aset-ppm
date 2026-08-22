import { describe, expect, it } from "vitest";

import { describeChangeValue, planActivityRow } from "./activity-display";

describe("planActivityRow", () => {
  it("plans a created row as simple", () => {
    expect(
      planActivityRow("created", { assetCode: "PPM-LAB-2026-0001" }, "en"),
    ).toEqual({
      kind: "simple",
      type: "created",
    });
  });

  it("plans a deleted row as simple, ignoring its payload", () => {
    expect(
      planActivityRow("deleted", { assetCode: "PPM-LAB-2026-0001" }, "en"),
    ).toEqual({
      kind: "simple",
      type: "deleted",
    });
  });

  it("plans photo_added and photo_removed as simple", () => {
    expect(planActivityRow("photo_added", { photoId: "p1" }, "en").kind).toBe(
      "simple",
    );
    expect(planActivityRow("photo_removed", { photoId: "p1" }, "en").kind).toBe(
      "simple",
    );
  });

  it("plans a well-formed status_changed row", () => {
    expect(
      planActivityRow(
        "status_changed",
        { from: "active", to: "in_repair" },
        "en",
      ),
    ).toEqual({ kind: "status_changed", from: "active", to: "in_repair" });
  });

  it("falls back to unrecognised on a malformed status_changed payload", () => {
    expect(planActivityRow("status_changed", { from: 1 }, "en")).toEqual({
      kind: "unrecognised",
    });
  });

  it("resolves an unrecognised stored status to null rather than throwing", () => {
    expect(
      planActivityRow(
        "status_changed",
        { from: "on_shelf", to: "active" },
        "en",
      ),
    ).toEqual({ kind: "status_changed", from: null, to: "active" });
  });

  it("plans an updated row's changes, dropping any field it does not recognise", () => {
    const plan = planActivityRow(
      "updated",
      {
        changes: {
          name: { from: "Old name", to: "New name" },
          notARealField: { from: 1, to: 2 },
        },
      },
      "en",
    );
    expect(plan).toEqual({
      kind: "updated",
      changes: [
        {
          field: "name",
          isOpaque: false,
          from: { kind: "text", text: "Old name" },
          to: { kind: "text", text: "New name" },
        },
      ],
    });
  });

  it("marks an id-referencing field as opaque and does not resolve its value", () => {
    const plan = planActivityRow(
      "updated",
      { changes: { categoryId: { from: "cat-1", to: "cat-2" } } },
      "en",
    );
    expect(plan).toEqual({
      kind: "updated",
      changes: [
        {
          field: "categoryId",
          isOpaque: true,
          from: { kind: "text", text: "cat-1" },
          to: { kind: "text", text: "cat-2" },
        },
      ],
    });
  });

  it("falls back to unrecognised on a malformed updated payload", () => {
    expect(
      planActivityRow("updated", { changes: "not an object" }, "en"),
    ).toEqual({
      kind: "unrecognised",
    });
  });

  it("falls back to unrecognised on a completely unknown event type", () => {
    expect(planActivityRow("some_future_event", {}, "en")).toEqual({
      kind: "unrecognised",
    });
  });
});

describe("describeChangeValue", () => {
  it("reports a null value as empty", () => {
    expect(describeChangeValue("brand", null, "en")).toEqual({ kind: "empty" });
  });

  it("resolves a condition value to its own kind, not a plain string", () => {
    expect(describeChangeValue("condition", "poor", "en")).toEqual({
      kind: "condition",
      value: "poor",
    });
  });

  it("formats acquisitionYear ungrouped, never with a thousands separator", () => {
    expect(describeChangeValue("acquisitionYear", 2026, "en")).toEqual({
      kind: "text",
      text: "2026",
    });
    expect(describeChangeValue("acquisitionYear", 2026, "id")).toEqual({
      kind: "text",
      text: "2026",
    });
  });

  it("formats purchasePrice as IDR currency", () => {
    const display = describeChangeValue("purchasePrice", "1500000.00", "en");
    expect(display.kind).toBe("text");
    if (display.kind === "text") {
      expect(display.text).toContain("1,500,000");
    }
  });

  it("formats warrantyUntil as a locale date", () => {
    const display = describeChangeValue(
      "warrantyUntil",
      "2027-01-15T00:00:00.000Z",
      "en",
    );
    expect(display).toEqual({ kind: "text", text: "January 15, 2027" });
  });

  it("passes a plain text field through unchanged", () => {
    expect(describeChangeValue("vendor", "PT Contoh", "en")).toEqual({
      kind: "text",
      text: "PT Contoh",
    });
  });
});
