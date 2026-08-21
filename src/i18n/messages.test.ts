import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import id from "../../messages/id.json";

/**
 * A message catalogue nests one level: a namespace object of string values.
 * `next-intl` supports deeper nesting too, so the walk below is recursive
 * rather than assuming this exact shape.
 */
type MessageTree = { readonly [key: string]: string | MessageTree };

function flattenKeys(tree: MessageTree, prefix = ""): readonly string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      keys.push(path);
    } else {
      keys.push(...flattenKeys(value, path));
    }
  }
  return keys;
}

function keysMissingFrom(
  source: readonly string[],
  target: ReadonlySet<string>,
): readonly string[] {
  return source.filter((key) => !target.has(key));
}

describe("message catalogue parity", () => {
  const idKeys = flattenKeys(id);
  const enKeys = flattenKeys(en);

  it("has every id.json key present in en.json", () => {
    const missing = keysMissingFrom(idKeys, new Set(enKeys));
    expect(
      missing,
      `Keys present in messages/id.json but missing from messages/en.json: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("has every en.json key present in id.json", () => {
    const missing = keysMissingFrom(enKeys, new Set(idKeys));
    expect(
      missing,
      `Keys present in messages/en.json but missing from messages/id.json: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("declares at least one namespace, so an empty catalogue cannot pass by vacuity", () => {
    expect(idKeys.length).toBeGreaterThan(0);
  });
});
