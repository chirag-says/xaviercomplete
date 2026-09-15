/**
 * Security headers, and the rule that nothing here is ever cached or indexed.
 *
 * Stricter than the public site's equivalent, because every byte this
 * application serves is confidential and none of it has a legitimate reason to
 * be stored, shared or crawled.
 *
 * Middleware runs on the edge runtime, so nothing in this file may import the
 * database, `node:crypto`, or anything under the shared library. Session
 * resolution happens in server components and actions, which run on Node.
 *
 * ## The CSP is nonce-based, and it has to be
 *
 * Content-Security-Policy is set here rather than deferred to Phase 8 like the
 * public site's: the portal's markup is ours, with no Framer export to break.
 *
 * The first attempt used a flat `script-src 'self'`, which looked strict and
 * broke the entire application. Next's App Router ships its flight data in
 * ~27 **inline** `<script>` tags; `'self'` blocks every one, `self.__next_f`
 * is never populated, React never hydrates, and every button in the portal
 * silently does nothing. No console error, no failed request — the page just
 * sits there. Found on 11 September 2026 when a form submit produced no POST.
 *
 * The fix is the mechanism Next provides for exactly this. A fresh nonce per
 * request goes into the policy *and* into a `Content-Security-Policy` request
 * header, which Next reads to stamp the same nonce onto every script tag it
 * generates.
 *
 * `'strict-dynamic'` comes with it: the nonced bootstrap loads further chunks
 * by injecting script tags, and without it each of those would need its own
 * nonce. Under `strict-dynamic` a supporting browser ignores `'self'` and trusts
 * only what the nonced script loads — which is stricter than a host allowlist,
 * not weaker. `'self'` stays in the list for browsers that do not implement it.
 */

import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
  // Web Crypto, not node:crypto — this runs on the edge runtime.
  const nonce = crypto.randomUUID().replaceAll('-', '');

  /*
   * `unsafe-eval` in development only, and it is not optional there.
   *
   * Next's dev build wraps every webpack module body in `eval()` to get usable
   * source maps. Without this the script files fetch with a 200, the outer
   * wrapper runs, and every module body is silently refused — so React never
   * mounts, no fiber is ever created, and the portal renders as static HTML
   * where nothing responds. It looks exactly like a hydration bug and is not
   * one. Found on 11 September 2026, after the nonce fix below turned out not
   * to be the whole story.
   *
   * `next build` emits no `eval`, so production gets the strict policy. That is
   * the half that matters, and it is the half that ships.
   */
  const devEval = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    // Styles cannot execute, and Next injects a style element the App Router
    // depends on. `unsafe-inline` for styles alone is the standard concession;
    // script-src above is what actually stops injection.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  // Next reads this request header to find the nonce and applies it to the
  // script tags it renders. Without it the policy is correct and the page is
  // still blank.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const headers = response.headers;

  headers.set('Content-Security-Policy', csp);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');

  /*
   * `same-origin`, not `no-referrer`.
   *
   * The goal is that a portal URL — which can carry an alumni id or an
   * invitation token — never reaches a third-party site. `same-origin` does
   * exactly that: full referrer within admin.sxccaa.org, nothing at all when
   * leaving it.
   *
   * `no-referrer` looks stricter and quietly breaks the application. Under it,
   * Chrome serialises the `Origin` header of a form POST as the literal string
   * `null`, and Next's server-action handler parses that header as a URL — so
   * every form in the portal returns a 500. Found the same afternoon as the CSP
   * problem above, by the sign-in form doing precisely that. The
   * stricter-looking value bought no privacy the same-origin one does not, and
   * cost every mutation in the app.
   */
  headers.set('Referrer-Policy', 'same-origin');

  // Everything, without exception. There is no public page here.
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');

  if (request.nextUrl.protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
