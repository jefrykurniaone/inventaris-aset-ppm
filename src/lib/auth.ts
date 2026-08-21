import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { db } from "@/lib/db";

/**
 * Server-side Better Auth configuration. Together with `auth-client.ts` this is
 * the only place the library is configured (ADR 0002), so a change of
 * persistence layer or of authentication library stays inside two files.
 *
 * Level 1 of the ADR 0002 ladder: the built-in `better-auth/adapters/prisma`
 * adapter, handed the Prisma 7 client that `src/lib/db.ts` builds from the
 * generated output in `src/generated/prisma`. The library's documentation still
 * shows `import { PrismaClient } from "@prisma/client"`; only the import path
 * differs, and the adapter itself is indifferent to where the client came from.
 *
 * `secret` and `baseURL` are read from `BETTER_AUTH_SECRET` and
 * `BETTER_AUTH_URL` by the library, so they are not restated here.
 */
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  // `nextCookies` has to stay last in the list: it converts the cookies the
  // preceding plugins set into Next.js cookie writes.
  plugins: [admin(), nextCookies()],
});

/**
 * The route handler pair mounted at `/api/auth/[...all]`. It is built here
 * rather than in the route file so that `better-auth` keeps a single import
 * site on the server, as the seam rules require.
 */
export const authRouteHandlers = toNextJsHandler(auth);
