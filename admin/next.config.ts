import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // All shared modules now live inside this app's own source tree, so tracing
  // from __dirname (the default) is sufficient. The old `join(__dirname, '..')`
  // was required when src/lib/shared.ts reached into ../oxvercity.
  // The portal renders no user-supplied images in Phase 5; photo moderation in
  // Phase 6 streams through a route handler rather than the optimiser.
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
