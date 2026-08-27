import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  images: {
    /**
     * Asset photos are read from a public Supabase Storage bucket
     * (ADR 0005), so `next/image` has to be told the host is allowed.
     *
     * A wildcard host rather than `SUPABASE_URL`: the value is server-side
     * configuration that CI does not hold, and a build whose image policy
     * depends on an absent variable silently produces a deployment that
     * refuses its own images. The path is narrowed instead — only the public
     * object route of a Supabase project can match.
     *
     * Every photo surface but one renders these with `unoptimized`, because a
     * 400 px thumbnail drawn at 64 px gains nothing from a second encoding.
     * The exception is the public scan page's full-size photo: it is that
     * route's Largest Contentful Paint element, and 125,866 bytes fetched
     * cross-origin for a 380 CSS px slot is what made the route miss its
     * 2500 ms LCP budget (issue #110), so that one goes through the
     * optimiser. This entry is what makes that a per-surface rendering choice
     * rather than the only thing standing between the page and a blocked
     * image.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

// Reads `src/i18n/request.ts` by convention — see that file for why there is
// no `[locale]` route segment and no `next-intl` middleware.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
