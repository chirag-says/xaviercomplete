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
  /*
   * Trace from this directory, and never let Next guess.
   *
   * The comment that used to sit here said tracing from `__dirname` was "the
   * default". It is not. When `outputFileTracingRoot` is unset, Next walks
   * upwards looking for lockfiles and infers a workspace root from what it
   * finds — and this repository has three (admin, mobile, oxvercity), so it
   * finds several, warns that it may have guessed wrong, and picks one.
   *
   * On a developer machine that guess was `D:\bun.lock`, i.e. the **drive
   * root**. On a deploy host it is whatever sits above the checkout. Either way
   * Next then tries to trace file dependencies across that entire tree —
   * oxvercity, mobile, .git, every sibling node_modules — which on a build
   * container with a memory cap means minutes of file I/O and then the process
   * being killed. No error, no output, nothing in the log to explain it,
   * because the build never reached the point of having anything to say.
   *
   * That is exactly the failure this portal hit on Hostinger while the public
   * site deployed fine: oxvercity/next.config.ts has set this since it was
   * written, and this file never did.
   *
   * `__dirname` is correct here because every shared module now lives inside
   * this app's own source tree. Nothing under src/ reaches into ../oxvercity.
   */
  outputFileTracingRoot: __dirname,
  // The portal renders no user-supplied images in Phase 5; photo moderation in
  // Phase 6 streams through a route handler rather than the optimiser.
  images: { unoptimized: true },
  // Nothing gains from announcing the framework version on a portal holding
  // five hundred people's contact details.
  poweredByHeader: false,
};

export default nextConfig;
