import { afterEach, describe, expect, it } from "vitest";

import { buildScanUrl } from "./scan-url";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

describe("buildScanUrl", () => {
  afterEach(() => {
    if (ORIGINAL_APP_URL === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
    }
  });

  it("joins the configured base URL and the token", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://inventaris.ppm.example";
    expect(buildScanUrl("abc123DEF456")).toBe(
      "https://inventaris.ppm.example/a/abc123DEF456",
    );
  });

  it("strips a trailing slash from the configured base URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://inventaris.ppm.example/";
    expect(buildScanUrl("abc123DEF456")).toBe(
      "https://inventaris.ppm.example/a/abc123DEF456",
    );
  });

  it("falls back to localhost:3000 when the variable is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(buildScanUrl("abc123DEF456")).toBe(
      "http://localhost:3000/a/abc123DEF456",
    );
  });
});
