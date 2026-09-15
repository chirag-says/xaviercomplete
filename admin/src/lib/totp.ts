/**
 * TOTP — RFC 6238, on top of HMAC-OTP (RFC 4226).
 *
 * Hand-written rather than pulled in, for two reasons. It is thirty lines of
 * HMAC over a counter, fully specified, with official test vectors that
 * tests/totp.test.ts checks against — so "did we get it right" is answerable
 * rather than a matter of trust. And the alternative packages pull a tree of
 * dependencies onto the one machine in this system that holds both the
 * encryption keys and the admin credentials.
 *
 * ## The two details that are easy to get wrong
 *
 * **The window.** A phone's clock drifts and a person takes a few seconds to
 * type. Accepting only the current 30-second step locks people out; accepting a
 * wide window hands an attacker more valid codes. ±1 step — a 90-second span —
 * is the standard compromise and what RFC 6238 §5.2 suggests.
 *
 * **The comparison.** Comparing codes with `===` leaks, through timing, how
 * many leading digits were right. Over enough attempts that is a six-digit
 * space walked one digit at a time. Every comparison here is constant-time.
 *
 * ## Replay
 *
 * A code stays valid for its whole step, so a code phished and used within
 * seconds still works. {@link verifyTotp} returns the step it matched so the
 * caller can record it and refuse that step again — see `admin_user.totp_last_step`.
 * Without that, an attacker who watches one login can replay it.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { base32Decode, base32Encode } from './base32.ts';

/** RFC 6238's default, and what every authenticator app assumes. */
export const STEP_SECONDS = 30;
export const DIGITS = 6;

/** ±1 step. See the note above. */
const WINDOW = 1;

/** 160 bits, the size RFC 4226 §4 requires for HMAC-SHA-1. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/**
 * One HOTP value for a counter (RFC 4226 §5.3).
 *
 * SHA-1 is not a weakness here and is not negotiable: it is what every
 * authenticator app implements. HMAC-SHA-1's security does not rest on SHA-1's
 * collision resistance, which is the property that fell.
 */
function hotp(secret: Buffer, counter: number, digits: number, algorithm: string): string {
  const counterBytes = Buffer.alloc(8);
  // A 64-bit counter written as two 32-bit halves: JavaScript's bitwise
  // operators are 32-bit, so `counter >>> 32` would silently be a no-op.
  counterBytes.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  counterBytes.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac(algorithm, secret).update(counterBytes).digest();

  // Dynamic truncation, RFC 4226 §5.3.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 10 ** digits).padStart(digits, '0');
}

export interface TotpOptions {
  digits?: number;
  stepSeconds?: number;
  algorithm?: 'sha1' | 'sha256' | 'sha512';
  /** Milliseconds since the epoch. Injected so tests can pin the RFC vectors. */
  now?: number;
}

/** The code for a moment in time. Exported for tests and for the CLI's enrolment check. */
export function totpAt(base32Secret: string, options: TotpOptions = {}): string {
  const { digits = DIGITS, stepSeconds = STEP_SECONDS, algorithm = 'sha1', now = Date.now() } = options;
  const counter = Math.floor(now / 1000 / stepSeconds);
  return hotp(base32Decode(base32Secret), counter, digits, algorithm);
}

export type TotpResult =
  | { ok: true; step: number }
  | { ok: false; reason: 'malformed' | 'mismatch' | 'replayed' };

/**
 * Check a code the user typed.
 *
 * `lastUsedStep` is the counter of the last code this account signed in with.
 * Passing it makes a code single-use: a replay inside the same 30-second window
 * is refused rather than accepted a second time.
 */
export function verifyTotp(
  base32Secret: string,
  candidate: unknown,
  options: TotpOptions & { lastUsedStep?: number | null } = {},
): TotpResult {
  const { digits = DIGITS, stepSeconds = STEP_SECONDS, algorithm = 'sha1', now = Date.now() } = options;

  if (typeof candidate !== 'string') return { ok: false, reason: 'malformed' };
  const typed = candidate.replace(/[\s-]/g, '');
  if (!new RegExp(`^\\d{${digits}}$`).test(typed)) return { ok: false, reason: 'malformed' };

  const secret = base32Decode(base32Secret);
  const current = Math.floor(now / 1000 / stepSeconds);
  const typedBuffer = Buffer.from(typed, 'utf8');

  // Every step in the window is checked even after a match, so the time taken
  // does not reveal which step matched — and therefore nothing about the
  // client's clock offset.
  let matched: number | null = null;
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    const step = current + offset;
    const expected = Buffer.from(hotp(secret, step, digits, algorithm), 'utf8');
    if (expected.length === typedBuffer.length && timingSafeEqual(expected, typedBuffer)) {
      matched = step;
    }
  }

  if (matched === null) return { ok: false, reason: 'mismatch' };
  if (lastStepBlocks(matched, options.lastUsedStep)) return { ok: false, reason: 'replayed' };
  return { ok: true, step: matched };
}

function lastStepBlocks(step: number, lastUsedStep: number | null | undefined): boolean {
  return typeof lastUsedStep === 'number' && step <= lastUsedStep;
}

/**
 * The `otpauth://` URI an authenticator app expects.
 *
 * The label carries the admin's email, which is personal data — so this string
 * is printed on the operator's own terminal during enrolment and never logged,
 * never emailed, and never written to disk.
 */
export function otpauthUri(email: string, secret: string, issuer = 'SXCCAA Admin'): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
