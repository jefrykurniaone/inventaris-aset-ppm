import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_COOKIE_NAME } from "./config";
import { setLocale } from "./set-locale";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockedCookies = vi.mocked(cookies);

describe("setLocale", () => {
  const set = vi.fn();

  beforeEach(() => {
    set.mockClear();
    mockedCookies.mockResolvedValue({
      set,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  it("writes a supported locale to the cookie", async () => {
    await setLocale("en");

    expect(set).toHaveBeenCalledWith(
      LOCALE_COOKIE_NAME,
      "en",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
  });

  it("rejects an unsupported value before it ever reaches the cookie store", async () => {
    await expect(setLocale("fr")).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects an empty string before it ever reaches the cookie store", async () => {
    await expect(setLocale("")).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });
});
