import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_BODY_BYTES } from "@/lib/photo-upload";

import {
  declaresOversizeBody,
  isSameOriginRequest,
  readBodyWithinCap,
} from "./upload-request";

/**
 * The two request checks that are worth more than one assertion each: which
 * `Origin` counts as this application's own, and how an oversize body is
 * refused without being read. The route-level outcomes (403, 413) are in
 * `route.test.ts`; this file pins down the edges.
 */

const APP_HOST = "localhost:3000";
const APP_ORIGIN = `http://${APP_HOST}`;
const CHUNK_BYTES = 64 * 1024;
const SMALL_CAP = 10;

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

/** A body that hands out `chunkBytes` per read, forever, and counts how many
 * reads it has served and whether it was cancelled. `highWaterMark: 0` means
 * nothing is pulled until a reader asks, so `pulls` is the number of chunks
 * the code under test actually read. */
function endlessBody(chunkBytes: number) {
  const probe = { pulls: 0, isCancelled: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        probe.pulls += 1;
        controller.enqueue(new Uint8Array(chunkBytes));
      },
      cancel() {
        probe.isCancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, probe };
}

function bodyOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

describe("isSameOriginRequest", () => {
  it("accepts the application's own origin", () => {
    expect(
      isSameOriginRequest(headers({ origin: APP_ORIGIN, host: APP_HOST })),
    ).toBe(true);
  });

  it.each([
    ["another site", "https://evil.example"],
    ["the same host on another port", "http://localhost:3001"],
    ["a sibling subdomain", "http://photos.localhost:3000"],
    ["an opaque origin", "null"],
    ["a value that is not a URL", "localhost:3000"],
  ])("refuses %s", (_label, origin) => {
    expect(isSameOriginRequest(headers({ origin, host: APP_HOST }))).toBe(
      false,
    );
  });

  it("refuses a request with no Origin at all", () => {
    expect(isSameOriginRequest(headers({ host: APP_HOST }))).toBe(false);
  });

  it("refuses a request with no host to compare against", () => {
    expect(isSameOriginRequest(headers({ origin: APP_ORIGIN }))).toBe(false);
  });

  it("compares against the first X-Forwarded-Host entry when a proxy set one", () => {
    const forwarded = headers({
      origin: "https://inventaris.example",
      host: "10.0.0.5:3000",
      "x-forwarded-host": "inventaris.example, proxy.internal",
    });

    expect(isSameOriginRequest(forwarded)).toBe(true);
  });

  it("does not fall back to Host when X-Forwarded-Host names someone else", () => {
    const forwarded = headers({
      origin: APP_ORIGIN,
      host: APP_HOST,
      "x-forwarded-host": "inventaris.example",
    });

    expect(isSameOriginRequest(forwarded)).toBe(false);
  });

  it("ignores the letter case of the Host header", () => {
    expect(
      isSameOriginRequest(
        headers({ origin: APP_ORIGIN, host: "LOCALHOST:3000" }),
      ),
    ).toBe(true);
  });
});

describe("declaresOversizeBody", () => {
  it("lets through a body declared at exactly the cap", () => {
    expect(
      declaresOversizeBody(
        headers({ "content-length": String(MAX_UPLOAD_BODY_BYTES) }),
      ),
    ).toBe(false);
  });

  it("refuses a body declared one byte over the cap", () => {
    expect(
      declaresOversizeBody(
        headers({ "content-length": String(MAX_UPLOAD_BODY_BYTES + 1) }),
      ),
    ).toBe(true);
  });

  it.each(["-1", "1e3", "0x10", "abc", ""])(
    "refuses a Content-Length of %j, which cannot be trusted to be small",
    (value) => {
      expect(declaresOversizeBody(headers({ "content-length": value }))).toBe(
        true,
      );
    },
  );

  it("leaves a body that declares no length to the streaming cap", () => {
    expect(declaresOversizeBody(headers({}))).toBe(false);
  });
});

describe("readBodyWithinCap", () => {
  it("returns every byte of a body inside the cap, in order", async () => {
    const body = bodyOf([
      Uint8Array.of(1, 2),
      Uint8Array.of(3),
      Uint8Array.of(4, 5),
    ]);

    await expect(readBodyWithinCap(body, SMALL_CAP)).resolves.toEqual(
      Uint8Array.of(1, 2, 3, 4, 5),
    );
  });

  it("accepts a body of exactly the cap", async () => {
    const body = bodyOf([new Uint8Array(SMALL_CAP)]);

    await expect(readBodyWithinCap(body, SMALL_CAP)).resolves.toHaveLength(
      SMALL_CAP,
    );
  });

  it("stops reading the moment the total passes the cap, and cancels the rest", async () => {
    const { stream, probe } = endlessBody(CHUNK_BYTES);

    await expect(readBodyWithinCap(stream)).resolves.toBeNull();

    const chunksToPassCap = Math.floor(MAX_UPLOAD_BODY_BYTES / CHUNK_BYTES) + 1;
    expect(probe.pulls).toBe(chunksToPassCap);
    expect(probe.isCancelled).toBe(true);
  });

  it("treats a missing body as an empty one", async () => {
    await expect(readBodyWithinCap(null)).resolves.toEqual(new Uint8Array(0));
  });
});
