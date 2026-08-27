import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  createCspNonce,
  CSP_HEADER_NAME,
  STATIC_SECURITY_HEADERS,
} from "./security-headers";

const NONCE = "T3N0Tm9uY2VWYWx1ZQ==";

const productionPolicy = () =>
  buildContentSecurityPolicy({ nonce: NONCE, isDevelopment: false });

const developmentPolicy = () =>
  buildContentSecurityPolicy({ nonce: NONCE, isDevelopment: true });

/** The sources of one directive, or `null` when the policy omits it. */
function directive(policy: string, name: string): string | null {
  const found = policy
    .split("; ")
    .find((part) => part === name || part.startsWith(`${name} `));
  if (found === undefined) {
    return null;
  }
  return found.slice(name.length).trim();
}

describe("createCspNonce", () => {
  const BASE64_NONCE_LENGTH = 24;

  it("returns 16 random bytes as base64", () => {
    const nonce = createCspNonce();

    expect(nonce).toHaveLength(BASE64_NONCE_LENGTH);
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  const SAMPLE_SIZE = 100;

  it("returns a different value every call, so one response's nonce cannot be replayed on the next", () => {
    const nonces = new Set(
      Array.from({ length: SAMPLE_SIZE }, () => createCspNonce()),
    );

    expect(nonces.size).toBe(SAMPLE_SIZE);
  });
});

describe("buildContentSecurityPolicy", () => {
  it("carries the nonce in script-src, which is what lets Next.js run its own inline scripts", () => {
    expect(directive(productionPolicy(), "script-src")).toContain(
      `'nonce-${NONCE}'`,
    );
  });

  it("never allows unsafe-inline for scripts", () => {
    expect(directive(productionPolicy(), "script-src")).not.toContain(
      "'unsafe-inline'",
    );
  });

  it("omits strict-dynamic, which would block the self-hosted compression worker's importScripts", () => {
    expect(productionPolicy()).not.toContain("'strict-dynamic'");
  });

  it("names no third-party script host", () => {
    expect(directive(productionPolicy(), "script-src")).toBe(
      `'self' 'nonce-${NONCE}'`,
    );
  });

  it("allows the Supabase public object host, so asset photos still render", () => {
    expect(directive(productionPolicy(), "img-src")).toContain(
      "https://*.supabase.co",
    );
  });

  it("allows the Supabase host for connections too, so the direct browser upload still works", () => {
    expect(directive(productionPolicy(), "connect-src")).toContain(
      "https://*.supabase.co",
    );
  });

  it("allows a blob worker, which is how photo compression runs off the main thread", () => {
    expect(directive(productionPolicy(), "worker-src")).toBe("'self' blob:");
  });

  it("allows data and blob images, which the compressor produces before upload", () => {
    const imgSrc = directive(productionPolicy(), "img-src");

    expect(imgSrc).toContain("data:");
    expect(imgSrc).toContain("blob:");
  });

  it("allows inline styles but carries no style nonce, since a nonce would disable them", () => {
    const styleSrc = directive(productionPolicy(), "style-src");

    expect(styleSrc).toContain("'unsafe-inline'");
    expect(styleSrc).not.toContain("nonce");
  });

  it.each([
    ["default-src", "'self'"],
    ["object-src", "'none'"],
    ["frame-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["media-src", "'none'"],
    ["font-src", "'self'"],
  ])("sets %s to %s", (name, sources) => {
    expect(directive(productionPolicy(), name)).toBe(sources);
  });

  it("relaxes exactly two directives in development and nothing else", () => {
    const development = developmentPolicy();

    expect(directive(development, "script-src")).toContain("'unsafe-eval'");
    expect(directive(development, "connect-src")).toContain("ws:");
    expect(directive(development, "style-src")).toBe(
      directive(productionPolicy(), "style-src"),
    );
  });

  it("keeps unsafe-eval and the websocket scheme out of a production policy", () => {
    const production = productionPolicy();

    expect(production).not.toContain("'unsafe-eval'");
    expect(production).not.toContain("ws:");
  });

  it("upgrades insecure requests in production only, so the development websocket is left alone", () => {
    expect(directive(productionPolicy(), "upgrade-insecure-requests")).toBe("");
    expect(directive(developmentPolicy(), "upgrade-insecure-requests")).toBe(
      null,
    );
  });
});

describe("STATIC_SECURITY_HEADERS", () => {
  it("sets nosniff, frame protection, a referrer policy and a permissions policy", () => {
    expect(
      STATIC_SECURITY_HEADERS.map(({ key, value }) => [key, value]),
    ).toEqual([
      ["X-Content-Type-Options", "nosniff"],
      ["X-Frame-Options", "DENY"],
      ["Referrer-Policy", "strict-origin-when-cross-origin"],
      [
        "Permissions-Policy",
        "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()",
      ],
    ]);
  });

  it("sends no referrer path off-site, so a scanned QR token cannot leak in one", () => {
    const referrerPolicy = STATIC_SECURITY_HEADERS.find(
      ({ key }) => key === "Referrer-Policy",
    );

    expect(referrerPolicy?.value).not.toContain("unsafe-url");
    expect(referrerPolicy?.value).toBe("strict-origin-when-cross-origin");
  });

  it("does not duplicate Strict-Transport-Security, which the platform already serves", () => {
    const keys = STATIC_SECURITY_HEADERS.map(({ key }) => key);

    expect(keys).not.toContain("Strict-Transport-Security");
    expect(keys).not.toContain(CSP_HEADER_NAME);
  });
});
