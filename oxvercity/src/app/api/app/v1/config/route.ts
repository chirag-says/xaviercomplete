/**
 * GET /api/app/v1/config — what the app needs to know before it does anything.
 *
 * ## Why a shipped app needs this
 *
 * A website is patched by deploying. An app is patched by asking several hundred
 * people to visit a store, and some of them never will. So the one thing that
 * must exist from the first release is a way to tell an old binary that it is
 * old — `minSupportedVersion`. Without it, a build that breaks sign-in is
 * unfixable for whoever does not update, and the only remedy left is a support
 * email to every alumnus.
 *
 * It also carries the Turnstile facts. The app cannot hardcode them: whether a
 * challenge is required depends on server configuration, and the site key can be
 * rotated in Cloudflare without anyone rebuilding an app. Asking at launch means
 * a key rotation is a server change, as it should be.
 *
 * ## Public, and nothing in it is a secret
 *
 * No session, no bearer token. Everything here is already public: the Turnstile
 * *site* key is designed to be read by any browser that loads the widget, and a
 * minimum version number tells an attacker nothing they could not learn by
 * downloading the app.
 *
 * The response is deliberately small and deliberately boring. Feature flags
 * belong here; anything that varies per alumnus does not — that would make this
 * a per-user response with a shared cache header, which is how one person ends
 * up seeing another's configuration.
 */

import { NextResponse } from 'next/server';

import { turnstileSiteKey } from '@/lib/turnstile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The oldest build allowed to talk to this server.
 *
 * Defaults to `0.0.0`, which gates nothing. That is the right default: a
 * misconfigured or empty environment variable must not lock every client out of
 * an app that was working a minute ago. Raising it is a deliberate act.
 */
function minSupportedVersion(): string {
  return process.env.APP_MIN_VERSION?.trim() || '0.0.0';
}

/**
 * Mirrors `required()` in src/lib/turnstile.ts.
 *
 * Duplicated rather than exported because that function is private and describes
 * server behaviour, whereas this describes what the *app* should do — render a
 * challenge or skip straight to the form. They agree today and are allowed to
 * diverge: a server could accept requests without a challenge while still asking
 * the app to try for one.
 */
function turnstileRequired(): boolean {
  if (process.env.REQUIRE_TURNSTILE === 'false') return false;
  if (process.env.REQUIRE_TURNSTILE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

export async function GET(): Promise<NextResponse> {
  const appUrl = process.env.APP_URL?.replace(/\/+$/, '') ?? '';

  const response = NextResponse.json(
    {
      minSupportedVersion: minSupportedVersion(),
      turnstile: {
        required: turnstileRequired(),
        siteKey: turnstileSiteKey(),
        // The page the app loads in a WebView to render the widget. Null when
        // APP_URL is unset, which the app reads as "no challenge available" and
        // handles as a visible error rather than a blank WebView.
        embedUrl: appUrl ? `${appUrl}/embed/turnstile` : null,
      },
      features: {
        eventPhotos: true,
        notifications: true,
        // Connections were specified and then cut from scope. The flag is here
        // so a future server can switch the feature on for clients that already
        // support it, rather than needing a coordinated release.
        connections: false,
      },
    },
    { status: 200 },
  );

  // Short and shared: identical for every caller, and worth a cache so a cold
  // app launch on a slow connection is one round trip rather than two.
  response.headers.set('Cache-Control', 'public, max-age=300');
  return response;
}
