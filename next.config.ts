import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  async redirects() {
    // Quick Match moved under the Activities tab (see the nav/IA redesign) —
    // keep any old bookmarks/links working instead of 404ing.
    return [
      {
        source: '/communities/quick-match',
        destination: '/activities/quick-match/new',
        permanent: false,
      },
      {
        source: '/communities/quick-match/:id',
        destination: '/activities/quick-match/:id',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
