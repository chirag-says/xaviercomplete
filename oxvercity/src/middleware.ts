/**
 * Security headers on every response.
 *
 * Middleware runs on the edge runtime, so nothing in this file may import the
 * database, `node:crypto`, or anything under `src/lib/core`. Session resolution
 * happens in server components and route handlers, which run on Node.
 *
 * ## The CSP, added in Phase 8
 *
 * This was deferred on the assumption that a strict policy would break the
 * Framer-exported markup. Building the admin portal showed what actually
 * breaks and what does not, so it is here now:
 *
 * - **Framer's inline styles are fine.** The export uses inline `style`
 *   attributes everywhere, which `style-src 'unsafe-inline'` permits. A style
 *   cannot execute; `script-src` is what stops injection, and that one is strict.
 * - **Next's inline scripts are not fine without a nonce.** The App Router
 *   ships its flight data in ~27 inline `<script>` tags. A flat `script-src
 *   'self'` refuses every one: React never hydrates, every form and control
 *   silently stops working, and there is no console error to find. The nonce is
 *   minted per request here and handed to Next through a `Content-Security-Policy`
 *   *request* header, which it reads to stamp the same value onto its own tags.
 * - **`next dev` additionally needs `'unsafe-eval'`**, because the dev build
 *   wraps every webpack module body in `eval()` for source maps. `next build`
 *   emits none, so production keeps the strict policy — which is the half that
 *   ships.
 *
 * Turnstile is the only third party in the policy. Its script is injected by
 * our own bundled code, so `'strict-dynamic'` covers it; the challenge itself
 * renders in an iframe, which needs `frame-src`. Everything else — fonts,
 * images, the photo route — is same-origin.
 */

import { NextResponse, type NextRequest } from 'next/server';

/** Cloudflare's host, needed for the Turnstile widget and its iframe. */
const TURNSTILE = 'https://challenges.cloudflare.com';

function contentSecurityPolicy(nonce: string): string {
  const devEval = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE}${devEval}`,
    // Framer's export positions everything with inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    // `data:` covers the inline SVG fallbacks in the export. Photographs are
    // served from this origin by /api/photo, so 'self' already allows them —
    // and an explicit list is what stops injected markup beaconing an image
    // request out to an attacker's server.
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${TURNSTILE}`,
    "object-src 'none'",
    "base-uri 'self'",
    // Every form on this site posts to this site. Without it, an injection
    // could repoint the sign-in form at somewhere else entirely.
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * Let the Expo web build reach the app API during development.
 *
 * `expo start --web` serves the mobile client from its own Metro port, so every
 * call to `/api/app/v1/**` is cross-origin and the browser blocks it. Running
 * the app on web is the fastest way to review a screen without a device, and it
 * is worth keeping available for the whole build.
 *
 * **The real app is unaffected either way.** CORS is a browser policy; React
 * Native's `fetch` has no same-origin rule, so a device never needs this header
 * and never sends a preflight.
 *
 * Three gates, each doing real work:
 *
 *  1. **Never in production.** `NODE_ENV` decides, so this cannot be switched on
 *     by an environment variable someone sets by accident.
 *  2. **Only the app namespace.** The website's own routes keep their
 *     `isSameOrigin()` CSRF check untouched and unreachable from here.
 *  3. **Only a loopback or private-network origin**, echoed rather than `*`, so
 *     a page on the public internet cannot use a developer's running server.
 *
 * `Access-Control-Allow-Credentials` is deliberately absent. That header is what
 * would make CORS dangerous — it is the one that lets a cross-origin page send
 * ambient cookies. These routes read no cookie (see app-auth.ts), the app sends
 * `credentials: 'omit'`, and without this header the browser refuses to attach
 * one regardless.
 */
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.)[^/]*$/;

function devCorsHeaders(request: NextRequest): Record<string, string> | null {
  if (process.env.NODE_ENV === 'production') return null;
  if (!request.nextUrl.pathname.startsWith('/api/app/v1/')) return null;

  const origin = request.headers.get('origin');
  if (!origin || !DEV_ORIGIN.test(origin)) return null;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-None-Match',
    'Access-Control-Expose-Headers': 'ETag, Retry-After',
    // Vary on Origin so a cached /content response for one dev origin is not
    // replayed to another with the wrong header.
    Vary: 'Origin',
  };
}

export function middleware(request: NextRequest): NextResponse {
  const cors = devCorsHeaders(request);

  // A preflight carries no credentials and needs no CSP; answer and stop.
  if (cors && request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: cors });
  }

  // Web Crypto, not node:crypto — this runs on the edge runtime.
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const csp = contentSecurityPolicy(nonce);

  // Next reads this *request* header to find the nonce and applies it to the
  // script tags it renders. Without it the policy is correct and the page is
  // inert.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const headers = response.headers;

  headers.set('Content-Security-Policy', csp);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');

  /*
   * `same-origin`, not `no-referrer`.
   *
   * The aim is that a URL from this site — which on a profile or /me carries an
   * alumni id — never reaches a third party. `same-origin` does exactly that:
   * the full referrer within sxccaa.org, nothing at all when leaving it.
   *
   * `no-referrer` looks stricter and breaks every form on the site. Under it
   * Chrome serialises the `Origin` header of a form POST as the literal string
   * `null`. Next's server-action handler parses that header as a URL and
   * returns a 500, and `isSameOrigin` in src/lib/request.ts — which falls back
   * to `Referer` when `Origin` is absent — finds neither and refuses the
   * request. That would have taken out the sign-in form and every control on
   * /me. Found on 11 September 2026 while building the admin portal, which sets
   * the same header and failed the same way.
   */
  headers.set('Referrer-Policy', 'same-origin');
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  );

  // Only meaningful over HTTPS, and actively unhelpful on a local http server —
  // one stray HSTS header pins localhost to https for six months.
  if (request.nextUrl.protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // Nothing that can vary by who is signed in may be cached by a CDN or a
  // shared proxy. A cached profile page is a public profile page, whatever the
  // authorisation code says.
  //
  // `/alumni` is in this list as well as `/alumni/<id>`: the grid renders
  // clickable cards with a hover overlay for a signed-in viewer and inert ones
  // for everybody else, so one cached copy served to both is either a leak or a
  // lock-out depending on who filled the cache first.
  const path = request.nextUrl.pathname;
  const isProfile = /^\/alumni\/[^/]+/.test(path);

  // Two routes are excluded, because their caching depends on the content
  // rather than the path and the handler is the only thing that knows.
  //
  //   /api/photo  — an approved public photograph may sit in a CDN for an hour;
  //                 an alumni-only one must not be stored anywhere shared.
  //   /api/poster — an event poster is public by nature and is fetched by mail
  //                 clients that hold no session. It must cache hard, or one
  //                 popular event turns five hundred inbox opens into five
  //                 hundred database reads.
  //
  // The mobile API adds two, and they are listed as **exact paths on purpose**.
  // `/api/app/v1/config` and `/api/app/v1/content` are identical for every
  // caller — the same words an anonymous visitor reads on the website — so they
  // are safe to cache and expensive not to: without it, every app launch
  // re-downloads a hundred kilobytes of copy that has not changed.
  //
  // Every *other* route under /api/app/v1 varies by who is asking, so a prefix
  // match here would quietly put one alumnus's directory page and profile into
  // a shared cache. That is why this is `===` and not `startsWith`, and it must
  // stay that way as the namespace grows.
  const decidesOwnCaching =
    path.startsWith('/api/photo') ||
    path.startsWith('/api/poster') ||
    path === '/api/app/v1/config' ||
    path === '/api/app/v1/content';

  if (
    !decidesOwnCaching &&
    (path.startsWith('/api/') ||
      path.startsWith('/me') ||
      path.startsWith('/login') ||
      path.startsWith('/alumni'))
  ) {
    headers.set('Cache-Control', 'private, no-store, max-age=0');
  }

  // Sign-in and individual profiles have no business in a search index. The
  // directory listing at /alumni is left indexable — it carries only the five
  // public card fields, and the Association wants to be findable.
  if (path.startsWith('/login') || path.startsWith('/me') || path.startsWith('/api/') || isProfile) {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  // Development only, app namespace only, private origins only. See
  // devCorsHeaders above for why each of those three gates is there.
  if (cors) {
    for (const [name, value] of Object.entries(cors)) headers.set(name, value);
  }

  return response;
}

export const config = {
  // Static assets and the image optimiser gain nothing from these headers and
  // are requested constantly.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)'],
};
