import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setTheme } from "./set-theme";
import { THEME_COOKIE_NAME } from "./theme";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockedCookies = vi.mocked(cookies);

describe("setTheme", () => {
  const set = vi.fn();

  beforeEach(() => {
    set.mockClear();
    mockedCookies.mockResolvedValue({
      set,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  it("writes a supported theme to the cookie", async () => {
    await setTheme("dark");

    expect(set).toHaveBeenCalledWith(
      THEME_COOKIE_NAME,
      "dark",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
  });

  it("rejects an unsupported value before it ever reaches the cookie store", async () => {
    await expect(setTheme("system")).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects an empty string before it ever reaches the cookie store", async () => {
    await expect(setTheme("")).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });
});
