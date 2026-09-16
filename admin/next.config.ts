import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    /*
     * Above the largest thing an administrator can upload, with headroom.
     *
     * Next's default is 1 MB, and without this line every upload over that size
     * is refused by the framework before the action body runs. The failure is
     * invisible: `guarded()` never sees it, so a 3 MB spreadsheet reports
     * "Something went wrong. Nothing was changed." and the operator has no way
     * to tell that from a parsing failure.
     *
     * Two limits sit under this one and both are the real controls —
     * MAX_IMPORT_BYTES (5 MB, src/lib/alumni-import.ts) and
     * MAX_POSTER_UPLOAD_BYTES (8 MB, src/lib/broadcast.ts). This number must
     * stay above the larger of them, or the code's own message is unreachable.
     */
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // All shared modules now live inside this app's own source tree, so tracing
  // from __dirname (the default) is sufficient. The old `join(__dirname, '..')`
  // was required when src/lib/shared.ts reached into ../oxvercity.
  // The portal renders no user-supplied images in Phase 5; photo moderation in
  // Phase 6 streams through a route handler rather than the optimiser.
  images: { unoptimized: true },
  // Nothing gains from announcing the framework version on a portal holding
  // five hundred people's contact details.
  poweredByHeader: false,
};

export default nextConfig;
