/**
 * robots.txt
 *
 * The second half of the `noindex` story. The `X-Robots-Tag` header in
 * middleware tells a crawler not to index a profile it has already fetched;
 * this tells it not to fetch one. Both are needed: a crawler that ignores
 * robots.txt still sees the header, and a crawler that respects robots.txt
 * never spends a request finding out.
 *
 * `/alumni` itself stays crawlable. It carries the five public card fields and
 * nothing else, and the Association wants to be found. Everything under it is
 * a single profile, and those are for signed-in Xaverians — a crawler would get
 * a 404 anyway, but saying so up front is cheaper for both sides.
 */

import type { MetadataRoute } from 'next';

// No `sitemap:` line yet — pointing at a URL that 404s is worse than omitting
// it. The sitemap lands with the rest of the SEO work in Phase 8, and must
// exclude every path disallowed here.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/alumni/', // individual profiles; the listing at /alumni is allowed
        '/me',
        '/login',
        '/api/',
      ],
    },
  };
}
