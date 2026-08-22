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
     * The components render these with `unoptimized`, because the pipeline
     * already stores exactly-sized derivatives and routing each render
     * through the optimiser is the egress cost PRD risk R2 exists to avoid.
     * This entry is what keeps that a rendering choice rather than the only
     * thing standing between the page and a blocked image.
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
