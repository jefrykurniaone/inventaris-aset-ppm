import { authRouteHandlers } from "@/lib/auth";

/**
 * Better Auth's catch-all endpoint. The handlers come from `src/lib/auth.ts`,
 * built there with `toNextJsHandler`, so that this file imports the seam rather
 * than the library.
 */
export const { GET, POST } = authRouteHandlers;
