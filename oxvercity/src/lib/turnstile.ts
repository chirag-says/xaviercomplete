/**
 * Cloudflare Turnstile.
 *
 * Without it, the login form is a free oracle for sending mail to any address
 * an attacker cares to try, and the rate limits alone only slow that down.
 *
 * ## Fail-closed, but only where it matters
 *
 * If `TURNSTILE_SECRET_KEY` is unset the behaviour depends on the environment:
 *
 *   - **production** — every verification fails. A production deployment with
 *     no bot protection on a mail-sending endpoint is not a thing to ship by
 *     accident, and a loud failure on the login page is far cheaper to fix than
 *     a flagged sending domain.
 *   - **development** — verification passes, with a warning, so the login flow
 *     can be worked on before anyone has a Cloudflare account.
 *
 * `REQUIRE_TURNSTILE=false` overrides the production behaviour. It exists for a
 * staging box that genuinely has no keys; setting it in production is a
 * decision someone has to type out, not one they can drift into.
 */

const VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;
}

function required(): boolean {
  if (process.env.REQUIRE_TURNSTILE === 'false') return false;
  if (process.env.REQUIRE_TURNSTILE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

/**
 * Verify a challenge response.
 *
 * `remoteIp` is passed through to Cloudflare when known — it tightens their
 * scoring — but is not required, and the token is what actually proves
 * anything.
 */
export async function verifyTurnstile(token: string | null, remoteIp: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (required()) {
      console.error(
        '[turnstile] TURNSTILE_SECRET_KEY is not set and Turnstile is required here. Refusing the request.',
      );
      return false;
    }
    console.warn('[turnstile] not configured — allowing the request. This must not happen in production.');
    return true;
  }

  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const response = await fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;

    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    // A Cloudflare outage should not become an open door.
    console.error('[turnstile] verification failed', (error as Error).message);
    return false;
  }
}
