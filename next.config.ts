import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/resorts/:resort/panorama/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/resorts/:resort/overlays/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

const analyze = withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

export default analyze(nextConfig);
