import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/lib/auth";
import { ADMIN_ROLE, STAFF_ROLE } from "@/lib/roles";

import {
  getSessionUser,
  NOT_AUTHORIZED_PATH,
  requireAdmin,
  requireUser,
  SIGN_IN_PATH,
} from "./require-user";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    // Mirrors the real `redirect()`: it never returns, it throws. Tests
    // assert on the thrown marker rather than on a return value.
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

const mockedHeaders = vi.mocked(headers);
const mockedRedirect = vi.mocked(redirect);
const mockedGetSession = vi.mocked(auth.api.getSession);

function sessionFor(role: string | null, banned = false) {
  return {
    user: { id: "user-1", email: "user@example.invalid", role, banned },
    session: { id: "session-1" },
  } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>;
}

describe("getSessionUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHeaders.mockResolvedValue(
      new Headers() as unknown as Awaited<ReturnType<typeof headers>>,
    );
  });

  it("returns the session's user when a session exists", async () => {
    mockedGetSession.mockResolvedValue(sessionFor(STAFF_ROLE));

    await expect(getSessionUser()).resolves.toMatchObject({
      email: "user@example.invalid",
      role: STAFF_ROLE,
    });
  });

  it("returns null when there is no session", async () => {
    mockedGetSession.mockResolvedValue(null);

    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("returns null for a banned user even with a valid session (issue #114)", async () => {
    mockedGetSession.mockResolvedValue(sessionFor(STAFF_ROLE, true));

    await expect(getSessionUser()).resolves.toBeNull();
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHeaders.mockResolvedValue(
      new Headers() as unknown as Awaited<ReturnType<typeof headers>>,
    );
  });

  it("returns the signed-in user without redirecting", async () => {
    mockedGetSession.mockResolvedValue(sessionFor(STAFF_ROLE));

    await expect(requireUser()).resolves.toMatchObject({ role: STAFF_ROLE });
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("redirects to sign-in when no session exists, and never returns a user", async () => {
    mockedGetSession.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow(`REDIRECT:${SIGN_IN_PATH}`);
    expect(mockedRedirect).toHaveBeenCalledWith(SIGN_IN_PATH);
  });

  it("redirects a banned user to sign-in even with a valid session (issue #114)", async () => {
    mockedGetSession.mockResolvedValue(sessionFor(STAFF_ROLE, true));

    await expect(requireUser()).rejects.toThrow(`REDIRECT:${SIGN_IN_PATH}`);
    expect(mockedRedirect).toHaveBeenCalledWith(SIGN_IN_PATH);
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHeaders.mockResolvedValue(
      new Headers() as unknown as Awaited<ReturnType<typeof headers>>,
    );
  });

  it("returns the user when the role is admin", async () => {
    mockedGetSession.mockResolvedValue(sessionFor(ADMIN_ROLE));

    await expect(requireAdmin()).resolves.toMatchObject({ role: ADMIN_ROLE });
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("refuses a staff caller server-side by redirecting to not-authorized, never returning a user", async () => {
    mockedGetSession.mockResolvedValue(sessionFor(STAFF_ROLE));

    await expect(requireAdmin()).rejects.toThrow(
      `REDIRECT:${NOT_AUTHORIZED_PATH}`,
    );
    expect(mockedRedirect).toHaveBeenCalledWith(NOT_AUTHORIZED_PATH);
  });

  it("refuses a signed-out caller by redirecting to sign-in, not not-authorized", async () => {
    mockedGetSession.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow(`REDIRECT:${SIGN_IN_PATH}`);
    expect(mockedRedirect).toHaveBeenCalledWith(SIGN_IN_PATH);
    expect(mockedRedirect).not.toHaveBeenCalledWith(NOT_AUTHORIZED_PATH);
  });

  it("refuses a caller with no role at all (bare admin() default)", async () => {
    mockedGetSession.mockResolvedValue(sessionFor(null));

    await expect(requireAdmin()).rejects.toThrow(
      `REDIRECT:${NOT_AUTHORIZED_PATH}`,
    );
  });
});
