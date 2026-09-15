/**
 * Facts about the incoming request.
 *
 * Every IP that reaches the database is an HMAC. An IP address is personal data
 * under the DPDP Act, and everything the portal does with one — noticing a
 * burst of failed sign-ins in the audit log — is a comparison, never a read.
 */

import { headers } from 'next/headers';

import { ipBlindIndex } from './shared.ts';

function ipFrom(h: Headers): string | null {
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip')?.trim() || h.get('cf-connecting-ip')?.trim() || null;
}

export async function clientIpHash(): Promise<Buffer> {
  return ipBlindIndex(ipFrom(await headers()) ?? 'unknown');
}

export async function userAgent(): Promise<string | null> {
  const value = (await headers()).get('user-agent');
  return value ? value.slice(0, 512) : null;
}

/**
 * Same-origin check for state-changing requests.
 *
 * Next validates the Origin header on server actions already; this is the
 * second lock, used by the few places that accept a plain form POST, and the
 * one that still holds if a future route is mounted without going through an
 * action.
 */
export async function isSameOrigin(): Promise<boolean> {
  const h = await headers();
  const expected = process.env.ADMIN_URL;
  if (!expected) return false;

  const origin = h.get('origin') ?? h.get('referer');
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}
