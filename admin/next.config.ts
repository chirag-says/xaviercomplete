import type { NextConfig } from 'next';
import { join } from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // src/lib/shared.ts imports from ../oxvercity/src/lib, so tracing has to start
  // above both directories or the standalone build misses those files.
  outputFileTracingRoot: join(__dirname, '..'),
  // The portal renders no user-supplied images in Phase 5; photo moderation in
  // Phase 6 streams through a route handler rather than the optimiser.
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
