/**
 * Identifier and token generation.
 *
 * Every public identifier in this system is opaque. An alumnus's URL is
 * `/alumni/k3f9x2m7qp4w`, never `/alumni/priya-menon`, because a readable id
 * can be guessed, walked, and — when someone pastes the link into a group chat
 * — announces whose profile it is before anyone clicks.
 *
 * All randomness comes from `crypto.randomBytes`, never `Math.random`.
 */

import { randomBytes, randomInt } from 'node:crypto';

/**
 * Lowercase alphanumerics minus the four characters people mistype when reading
 * an id off a screen: `l` and `1`, `0` and `o`. Thirty-two symbols, so five
 * bits each and no modulo bias to work around.
 */
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz';

const ID_LENGTH = 12; // 12 × 5 bits = 60 bits. For ~500 rows, a collision is a fantasy.

function randomString(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    // 32 divides 256 exactly, so masking the low five bits is uniform.
    out += ALPHABET[bytes[i]! & 31];
  }
  return out;
}

/** The primary key for an alumni record. Not derived from the name — deliberately. */
export function newAlumniId(): string {
  return randomString(ID_LENGTH);
}

/** True if a string could be one of our ids. Cheap guard before a database round trip. */
export function isAlumniId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === ID_LENGTH &&
    [...value].every((character) => ALPHABET.includes(character))
  );
}

/**
 * A storage key for an uploaded photograph, unrelated to the alumni id.
 *
 * Keeping the two namespaces separate means a public photo URL cannot be walked
 * back to a profile URL, and a replaced photo's old URL dies rather than being
 * silently reused (plan §7.4).
 */
export function newPhotoKey(): string {
  return randomString(22);
}

/**
 * A single-use secret for a magic link, an admin invitation or a session.
 * 32 bytes, URL-safe. Only its SHA-256 is ever stored.
 */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * A six-digit verification code for the access-request flow.
 *
 * `randomInt` is used rather than arithmetic on random bytes because 1_000_000
 * is not a power of two, and the obvious `% 1000000` quietly makes low codes
 * more likely. `randomInt` rejects and resamples.
 */
export function newOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Ten one-time recovery codes for an admin who loses their authenticator (plan §9.2). */
export function newRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => `${randomString(5)}-${randomString(5)}`);
}
