import { describe, expect, it } from "vitest";

import {
  isMarkedRequired,
  type RequiredMarkerFieldSpec,
} from "./required-marker";

interface MarkerCase {
  readonly label: string;
  readonly spec: RequiredMarkerFieldSpec;
  readonly expected: boolean;
}

/** The whole truth table, as one parameterised test rather than five
 * near-identical ones (S5976). */
const MARKER_CASES: readonly MarkerCase[] = [
  {
    label: "required with nothing pre-filled",
    spec: { isRequired: true },
    expected: true,
  },
  {
    label: "required but pre-filled with a valid default",
    spec: { isRequired: true, hasPrefilledDefault: true },
    expected: false,
  },
  { label: "unflagged", spec: {}, expected: false },
  {
    label: "explicitly optional",
    spec: { isRequired: false },
    expected: false,
  },
  {
    label: "optional and pre-filled",
    spec: { hasPrefilledDefault: true },
    expected: false,
  },
];

describe("isMarkedRequired", () => {
  it.each(MARKER_CASES)(
    "returns $expected for a field that is $label",
    ({ spec, expected }) => {
      expect(isMarkedRequired(spec)).toBe(expected);
    },
  );
});
