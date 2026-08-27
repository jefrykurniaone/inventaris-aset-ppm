import { describe, expect, it } from "vitest";

import {
  findComboboxOption,
  groupComboboxOptions,
  matchesComboboxSearch,
  type ComboboxOption,
} from "./combobox-options";

const ROOMS: readonly ComboboxOption[] = [
  { id: "r1", label: "A A101 — Lab Jaringan", group: "A — Gedung A" },
  { id: "r2", label: "A A102 — Ruang Rapat", group: "A — Gedung A" },
  { id: "r3", label: "B B201 — Gudang", group: "B — Gedung B" },
];

describe("matchesComboboxSearch", () => {
  it("matches every option when the search is empty", () => {
    expect(matchesComboboxSearch("A A101 — Lab Jaringan", "")).toBe(true);
  });

  it("matches every option when the search is only whitespace", () => {
    expect(matchesComboboxSearch("A A101 — Lab Jaringan", "   ")).toBe(true);
  });

  it.each([
    ["lab", true],
    ["LAB", true],
    ["a101", true],
    ["gudang", false],
  ])("matches %s against a room label as %s", (search, expected) => {
    expect(matchesComboboxSearch("A A101 — Lab Jaringan", search)).toBe(
      expected,
    );
  });

  it("requires every term, regardless of the order they were typed in", () => {
    const label = "A A101 — Lab Jaringan";

    expect(matchesComboboxSearch(label, "lab a101")).toBe(true);
    expect(matchesComboboxSearch(label, "a101 lab")).toBe(true);
    expect(matchesComboboxSearch(label, "a101 gudang")).toBe(false);
  });
});

describe("groupComboboxOptions", () => {
  it("returns no groups for an empty list", () => {
    expect(groupComboboxOptions([])).toEqual([]);
  });

  it("keeps consecutive options of one building under one heading", () => {
    expect(groupComboboxOptions(ROOMS)).toEqual([
      { heading: "A — Gedung A", options: [ROOMS[0], ROOMS[1]] },
      { heading: "B — Gedung B", options: [ROOMS[2]] },
    ]);
  });

  it("gives an ungrouped list a single null heading", () => {
    const categories: readonly ComboboxOption[] = [
      { id: "c1", label: "ELK — Elektronik" },
      { id: "c2", label: "MBL — Mebel" },
    ];

    expect(groupComboboxOptions(categories)).toEqual([
      { heading: null, options: [categories[0], categories[1]] },
    ]);
  });

  it("opens a second block when a heading reappears out of order", () => {
    const outOfOrder: readonly ComboboxOption[] = [
      ROOMS[0],
      ROOMS[2],
      ROOMS[1],
    ];

    expect(groupComboboxOptions(outOfOrder)).toEqual([
      { heading: "A — Gedung A", options: [ROOMS[0]] },
      { heading: "B — Gedung B", options: [ROOMS[2]] },
      { heading: "A — Gedung A", options: [ROOMS[1]] },
    ]);
  });
});

describe("findComboboxOption", () => {
  it("finds the option a selected id points at", () => {
    expect(findComboboxOption(ROOMS, "r2")).toEqual(ROOMS[1]);
  });

  it("returns undefined for an empty selection", () => {
    expect(findComboboxOption(ROOMS, "")).toBeUndefined();
  });

  it("returns undefined for an id that is no longer in the list", () => {
    expect(findComboboxOption(ROOMS, "deactivated")).toBeUndefined();
  });
});
