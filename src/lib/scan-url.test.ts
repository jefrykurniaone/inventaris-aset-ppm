import { afterEach, describe, expect, it } from "vitest";

import { buildScanPath, buildScanUrl } from "./scan-url";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

// Restores the variable after every test in the file, not just the first
// block's — both describes below write to it.
afterEach(() => {
  if (ORIGINAL_APP_URL === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
  }
});

describe("buildScanUrl", () => {
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

  it("strips multiple trailing slashes from the configured base URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://inventaris.ppm.example////";
    expect(buildScanUrl("abc123DEF456")).toBe(
      "https://inventaris.ppm.example/a/abc123DEF456",
    );
  });

  it("resolves quickly for a long run of trailing slashes (typescript:S8786)", () => {
    const longRunOfSlashes = "/".repeat(50_000);
    process.env.NEXT_PUBLIC_APP_URL = `https://inventaris.ppm.example${longRunOfSlashes}`;
    const startedAt = performance.now();
    const result = buildScanUrl("abc123DEF456");
    expect(performance.now() - startedAt).toBeLessThan(100);
    expect(result).toBe("https://inventaris.ppm.example/a/abc123DEF456");
  });
});

describe("buildScanPath", () => {
  it("is the site-relative half of the scan URL", () => {
    expect(buildScanPath("abc123DEF456")).toBe("/a/abc123DEF456");
  });

  it("agrees with buildScanUrl about where the route lives", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://inventaris.ppm.example";
    expect(buildScanUrl("abc123DEF456")).toBe(
      `https://inventaris.ppm.example${buildScanPath("abc123DEF456")}`,
    );
  });
});
