"use client";

import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. The second and last place the library is
 * configured (ADR 0002).
 *
 * The plugin list mirrors the server: `adminClient` is the counterpart of the
 * server's `admin()` plugin and is what exposes `role` on the client session.
 * No `baseURL` is set, because the client and the API route are served from the
 * same origin.
 */
export const authClient = createAuthClient({
  plugins: [adminClient()],
});
