import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createActionErrorLogger,
  describeError,
  describeInput,
} from "./log-error";

describe("describeError", () => {
  it("returns an Error's message", () => {
    expect(describeError(new Error("record not found"))).toBe(
      "record not found",
    );
  });

  it("returns a subclass's message too", () => {
    expect(describeError(new TypeError("not a string"))).toBe("not a string");
  });

  it("returns a thrown string unchanged", () => {
    expect(describeError("plain rejection")).toBe("plain rejection");
  });

  // The whole point of the module: `String(value)` here would produce
  // "[object Object]" and throw away the only information the log carries.
  it("serialises a thrown plain object instead of stringifying it", () => {
    expect(describeError({ code: "P2003", meta: { field: "assetId" } })).toBe(
      '{"code":"P2003","meta":{"field":"assetId"}}',
    );
  });

  it("serialises an object shaped like a Better Auth APIError", () => {
    expect(describeError({ status: "UNAUTHORIZED", statusCode: 401 })).toBe(
      '{"status":"UNAUTHORIZED","statusCode":401}',
    );
  });

  it("survives a circular object graph", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;

    expect(describeError(circular)).toBe("[unserialisable]");
  });

  // A realistic case rather than a contrived one: Prisma returns `BigInt` for
  // some column types, so a rejected write can carry one in its metadata.
  // Written `BigInt(1)` rather than `1n` because `tsconfig.json` targets
  // ES2017, and BigInt literals need ES2020.
  it("survives a BigInt, which JSON.stringify refuses", () => {
    expect(describeError({ rows: BigInt(1) })).toBe("[unserialisable]");
  });

  it("survives an object whose toJSON throws", () => {
    const hostile = {
      toJSON() {
        throw new Error("no");
      },
    };

    expect(describeError(hostile)).toBe("[unserialisable]");
  });

  it.each([
    { label: "null", value: null, expected: "null" },
    { label: "undefined", value: undefined, expected: "undefined" },
    { label: "a number", value: 404, expected: "404" },
    { label: "false", value: false, expected: "false" },
    { label: "a BigInt", value: BigInt(7), expected: "7" },
  ])("renders $label as $expected", ({ value, expected }) => {
    expect(describeError(value)).toBe(expected);
  });

  // `${symbol}` throws a TypeError; `String(symbol)` does not. The module uses
  // the one that cannot fail, and this is the test that would catch a change
  // back to a template literal.
  it("renders a symbol without throwing", () => {
    expect(describeError(Symbol("token"))).toBe("Symbol(token)");
  });

  it("renders an array", () => {
    expect(describeError(["a", "b"])).toBe('["a","b"]');
  });
});

describe("describeInput", () => {
  it("serialises a form input object", () => {
    expect(describeInput({ code: "LAB", name: "Laboratorium" })).toBe(
      '{"code":"LAB","name":"Laboratorium"}',
    );
  });

  it("reports a value JSON.stringify returns undefined for", () => {
    expect(describeInput(undefined)).toBe("[not serialisable]");
  });

  it("reports a function, which JSON.stringify also skips", () => {
    expect(describeInput(() => "nope")).toBe("[not serialisable]");
  });

  it("reports a circular input rather than throwing", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(describeInput(circular)).toBe("[unserialisable]");
  });

  it("serialises null, which is a legitimate input", () => {
    expect(describeInput(null)).toBe("null");
  });
});

describe("createActionErrorLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes location, action, input and message to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logActionError = createActionErrorLogger("admin/categories/actions");

    logActionError(
      "createCategory",
      { code: "LAB" },
      new Error("unique constraint"),
    );

    expect(spy).toHaveBeenCalledWith(
      'admin/categories/actions.createCategory: input={"code":"LAB"} — unique constraint',
    );
  });

  it("logs a non-Error without losing it to [object Object]", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logActionError = createActionErrorLogger("admin/rooms/actions");

    logActionError("deleteRoom", { id: "r1" }, { code: "P2003" });

    expect(spy).toHaveBeenCalledWith(
      'admin/rooms/actions.deleteRoom: input={"id":"r1"} — {"code":"P2003"}',
    );
  });

  it("binds the location once, so two loggers do not share it", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    createActionErrorLogger("a/one")("act", undefined, "boom");
    createActionErrorLogger("b/two")("act", undefined, "boom");

    expect(spy).toHaveBeenNthCalledWith(
      1,
      "a/one.act: input=[not serialisable] — boom",
    );
    expect(spy).toHaveBeenNthCalledWith(
      2,
      "b/two.act: input=[not serialisable] — boom",
    );
  });
});
