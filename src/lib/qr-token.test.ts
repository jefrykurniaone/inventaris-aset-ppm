import { describe, expect, it } from "vitest";

import { generateQrToken, QR_TOKEN_LENGTH } from "./qr-token";

/** `nanoid`'s URL alphabet: `A-Za-z0-9_-`, and nothing that needs escaping in
 * a path segment, because the token is the public scan URL (PRD FR-2.2). */
const URL_SAFE_TOKEN = /^[A-Za-z0-9_-]+$/;

const SAMPLE_SIZE = 2000;

function sampleTokens(count: number): string[] {
  return Array.from({ length: count }, () => generateQrToken());
}

describe("generateQrToken", () => {
  it("is 12 characters, as FR-2.2 specifies", () => {
    expect(QR_TOKEN_LENGTH).toBe(12);
    expect(generateQrToken()).toHaveLength(QR_TOKEN_LENGTH);
  });

  it("stays 12 characters across a large sample", () => {
    const lengths = new Set(
      sampleTokens(SAMPLE_SIZE).map((token) => token.length),
    );

    expect([...lengths]).toEqual([QR_TOKEN_LENGTH]);
  });

  it("only uses characters that are safe in a URL path segment", () => {
    for (const token of sampleTokens(SAMPLE_SIZE)) {
      expect(token).toMatch(URL_SAFE_TOKEN);
    }
  });

  it("does not repeat itself across a large sample", () => {
    const tokens = sampleTokens(SAMPLE_SIZE);

    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("varies in every position, so no position is a fixed prefix", () => {
    const tokens = sampleTokens(SAMPLE_SIZE);

    for (let position = 0; position < QR_TOKEN_LENGTH; position += 1) {
      const distinct = new Set(tokens.map((token) => token[position]));
      expect(distinct.size).toBeGreaterThan(1);
    }
  });
});
