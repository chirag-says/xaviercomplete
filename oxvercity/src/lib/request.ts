/**
 * Facts about the incoming request, and the hashing of them.
 *
 * Every IP that reaches the database is an HMAC. An IP address is personal data
 * under the DPDP Act, and everything we do with one — rate limiting, spotting a
 * burst in the audit log — is a comparison, never a read. That is the blind
 * index case exactly, so it gets the same treatment as an email address.
 */

import { ipBlindIndex } from './core/hmac.ts';

/**
 * The client's address, as far as we can honestly tell.
 *
 * `x-forwarded-for` is client-controlled unless something upstream overwrites
 * it. On Vercel and behind Cloudflare it is overwritten, so the leftmost entry
 * is the real client. Self-hosted behind a proxy you have not configured to do
 * that, this header is a suggestion — which matters, because an attacker who
 * can set it freely can also reset their own rate-limit bucket at will.
 *
 * Returns null when there is no usable address; callers fall back to a
 * per-request constant rather than lumping every unknown client into one
 * bucket, which would let one of them lock out all the others.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || headers.get('cf-connecting-ip')?.trim() || null;
}

/**
 * A rate-limit and audit subject for this client.
 *
 * When the address is unknown the caller gets a hash of the literal string
 * "unknown", which is deliberate: unknown clients share a bucket, and if that
 * is ever a problem in practice it will show up as unknown clients being
 * throttled rather than as unlimited attempts going unnoticed.
 */
export function ipSubject(headers: Headers): Buffer {
  return ipBlindIndex(clientIp(headers) ?? 'unknown');
}

/** Trimmed to something sane before hashing; headers are attacker-controlled. */
export function userAgent(headers: Headers): string | null {
  const value = headers.get('user-agent');
  return value ? value.slice(0, 512) : null;
}

/**
 * Same-origin check for state-changing requests.
 *
 * `SameSite=Lax` already blocks the cross-site POST that CSRF depends on; this
 * is the second lock, and the one that still holds if a browser is lax about
 * the first or a future route is mounted as GET by accident.
 */
export function isSameOrigin(headers: Headers, appUrl: string): boolean {
  const origin = headers.get('origin');
  if (!origin) {
    // No Origin at all: a same-origin form post from an older browser, or a
    // non-browser client. Fall back to Referer, and if neither is present treat
    // it as untrusted rather than guessing generously.
    const referer = headers.get('referer');
    if (!referer) return false;
    try {
      return new URL(referer).origin === new URL(appUrl).origin;
    } catch {
      return false;
    }
  }
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Hold a response until `floorMs` has passed since `startedAt`.
 *
 * The login route must take the same time whether or not the address is on the
 * allowlist. Without this, a database lookup that hits and one that misses
 * differ by a few milliseconds, and anyone can test whether a given person is a
 * Xaverian by timing the response — which is the very disclosure the neutral
 * message exists to prevent.
 */
export async function padTo(startedAt: number, floorMs: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < floorMs) await new Promise((resolve) => setTimeout(resolve, floorMs - elapsed));
}
