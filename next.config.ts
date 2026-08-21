import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {};

// Reads `src/i18n/request.ts` by convention — see that file for why there is
// no `[locale]` route segment and no `next-intl` middleware.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
