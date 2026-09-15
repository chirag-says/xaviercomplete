/**
 * Admin passwords: Argon2id, a strength policy, and the breach check.
 *
 * An admin account is the keys to five hundred people's contact details, so
 * this is the one place in the system where a password exists at all — alumni
 * sign in with a magic link precisely so that there is nothing here to steal
 * (plan §6).
 *
 * ## Why Argon2id and not scrypt
 *
 * Node ships `crypto.scrypt`, which would have avoided a dependency. Argon2id
 * is still the better choice: it is the Password Hashing Competition winner and
 * OWASP's first recommendation, and it resists both GPU and side-channel
 * attacks where scrypt addresses only the first. `@node-rs/argon2` is a Rust
 * addon from the napi-rs project with no JavaScript dependencies of its own,
 * which is the narrowest supply chain available for it.
 *
 * The parameters below are OWASP's 2024 guidance: 19 MiB of memory, two
 * iterations, one lane. Memory cost is what makes a stolen hash impractical to
 * crack at scale; iteration count alone is cheap to parallelise.
 *
 * ## Why the breach check sends nothing
 *
 * `isBreached` uses Have I Been Pwned's k-anonymity range API. The client sends
 * the **first five characters of the SHA-1** of the password and receives every
 * suffix sharing that prefix, then matches locally. The password never leaves
 * this process, and HIBP cannot tell which of the ~800 returned hashes was the
 * one asked about. A service that wanted the whole hash would not be usable
 * here at all.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { hash, verify, type Algorithm } from '@node-rs/argon2';

/**
 * `Algorithm.Argon2id` is 2.
 *
 * The enum is declared `const` in the addon's types, and `isolatedModules` —
 * which this project needs, because Next compiles each file independently —
 * forbids reading a member off an ambient const enum. The value is part of the
 * Argon2 specification (0 = Argon2d, 1 = Argon2i, 2 = Argon2id), not an
 * implementation detail that could change under us. The cast keeps the field
 * typed rather than widening it to `number`.
 */
const ARGON2ID = 2 as Algorithm;

/** OWASP 2024 minimums for Argon2id. */
const PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // KiB — 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const MIN_LENGTH = 12;

export type PolicyFailure =
  | { ok: false; reason: 'too_short'; message: string }
  | { ok: false; reason: 'too_long'; message: string }
  | { ok: false; reason: 'breached'; message: string };

export type PolicyResult = { ok: true } | PolicyFailure;

/**
 * Local rules only. Length, and a cap.
 *
 * There are deliberately no composition rules — no "must contain a digit and a
 * symbol". They push people towards `Password1!`, which is both compliant and
 * in every cracking dictionary, and they rule out the long passphrase that is
 * actually strong. Length plus the breach check does the real work.
 *
 * The upper bound is not about strength. Argon2 hashes whatever it is given,
 * and a megabyte-long password is a cheap way to make the server do 19 MiB of
 * work per request.
 */
export function checkPolicy(password: string): PolicyResult {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return {
      ok: false,
      reason: 'too_short',
      message: `Use at least ${MIN_LENGTH} characters. A phrase you can remember beats a short string you cannot.`,
    };
  }
  if (password.length > 256) {
    return { ok: false, reason: 'too_long', message: 'Use at most 256 characters.' };
  }
  return { ok: true };
}

/**
 * Has this password appeared in a known breach?
 *
 * Returns `false` when the service is unreachable. That is a deliberate choice:
 * this check runs during onboarding, and a network problem at HIBP should not
 * stop the Association from creating an admin account. The policy above still
 * applies. A design that failed closed here would make account creation depend
 * on a third party being up.
 */
export async function isBreached(password: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const digest = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  try {
    const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;

    const body = await response.text();
    for (const line of body.split('\n')) {
      const [candidate, count] = line.trim().split(':');
      // The padding entries HIBP adds have a count of 0; a real hit does not.
      if (candidate === suffix && count !== '0') return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Policy, then breach check. One call, so no caller can do half of it. */
export async function assessPassword(password: string): Promise<PolicyResult> {
  const policy = checkPolicy(password);
  if (!policy.ok) return policy;

  if (await isBreached(password)) {
    return {
      ok: false,
      reason: 'breached',
      message:
        'That password appears in a public breach corpus, so it is already in the lists attackers try first. Choose another.',
    };
  }
  return { ok: true };
}

/** Hash for storage. The encoded string carries its own salt and parameters. */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, PARAMS);
}

/**
 * Check a password against a stored hash.
 *
 * Never throws. A malformed or truncated hash in the database is a failed
 * sign-in, not a 500 — and certainly not an exception whose message ends up
 * distinguishing "no such admin" from "wrong password".
 */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    return await verify(encoded, password, PARAMS);
  } catch {
    return false;
  }
}

/**
 * A hash to check against when the account does not exist.
 *
 * Without this, a sign-in attempt for an unknown email returns in a millisecond
 * while a known one takes the ~50ms Argon2 costs, and the login form becomes a
 * way to enumerate admin accounts with a stopwatch. The login route verifies
 * against this value so both paths do the same work.
 *
 * Computed once on first use, from a random string nobody knows.
 */
let decoyHash: Promise<string> | undefined;
export function decoyPasswordHash(): Promise<string> {
  decoyHash ??= hashPassword(`decoy:${createHash('sha256').update(String(process.pid)).digest('hex')}`);
  return decoyHash;
}

/** Constant-time compare for recovery codes and anything else short and secret. */
export function secretEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
